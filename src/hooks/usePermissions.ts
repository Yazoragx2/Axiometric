import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, onSnapshot, writeBatch } from 'firebase/firestore';
import { OWNER_EMAIL, UserRole, RolePermissions, Team, DEFAULT_ROLE_PERMISSIONS } from '../types';

export function usePermissions() {
  const [role, setRole] = useState<UserRole>('member');
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeTeam: (() => void) | null = null;
    let currentTeamId: string | null = null;

    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    // 1. Initial Profile Fetch
    const unsubscribeUser = onSnapshot(doc(db, 'users', user.uid), async (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        let userRole: UserRole = userData.role || 'member';
        
        // Ensure Owner status
        if (user.email === OWNER_EMAIL) {
          userRole = 'owner';
          
          // --- OWNER AUTO-ONBOARDING ---
          // If Owner has no teamId, initialize the "Core Team"
          if (!userData.teamId) {
            const teamId = 'core-team-id-' + user.uid.slice(0, 5); // Semi-predictable ID
            const newTeam: Team = {
              id: teamId,
              name: 'Core Team',
              ownerId: user.uid,
              members: {
                [user.uid]: {
                  uid: user.uid,
                  email: user.email!,
                  nickname: 'Owner',
                  role: 'owner',
                  joinedAt: new Date().toISOString()
                }
              },
              permissionsConfig: DEFAULT_ROLE_PERMISSIONS
            };

            try {
              const batch = writeBatch(db);
              batch.set(doc(db, 'teams', teamId), newTeam);
              batch.update(doc(db, 'users', user.uid), { 
                teamId,
                role: 'owner' 
              });
              await batch.commit();
              // The next snapshot will trigger the team listen
            } catch (e) {
              console.error('Auto-onboarding failed:', e);
            }
          }
        }
        
        setRole(userRole);

        // 2. Manage Team Listener
        if (userData.teamId) {
          // Only start a new team listener if it's not already watching the same team
          if (!unsubscribeTeam || currentTeamId !== userData.teamId) {
            if (unsubscribeTeam) unsubscribeTeam(); // Clean up old listener
            
            currentTeamId = userData.teamId;
            unsubscribeTeam = onSnapshot(doc(db, 'teams', userData.teamId), (teamSnap) => {
              if (teamSnap.exists()) {
                setTeam({ id: teamSnap.id, ...teamSnap.data() } as Team);
              }
              setLoading(false);
            });
          }
        } else {
          setLoading(false);
        }
      } else {
        // Fallback for missing profile
        if (user.email === OWNER_EMAIL) setRole('owner');
        setLoading(false);
      }
    });

    return () => {
      unsubscribeUser();
      if (unsubscribeTeam) unsubscribeTeam();
    };
  }, []);

  const getPermissions = (module: keyof RolePermissions): FeaturePermissions => {
    if (role === 'owner') return { view: true, edit: true, admin: true, upload: true };
    
    if (team?.permissionsConfig && team.permissionsConfig[role]) {
      return team.permissionsConfig[role][module];
    }

    // Default to strict member permissions if config is missing
    return DEFAULT_ROLE_PERMISSIONS.member[module];
  };

  const canDo = (module: keyof RolePermissions, action: 'view' | 'edit' | 'admin' | 'upload'): boolean => {
    const perms = getPermissions(module);
    return !!(perms as any)[action];
  };

  return { 
    role, 
    team, 
    loading, 
    isOwner: role === 'owner',
    isAdmin: role === 'admin' || role === 'owner',
    getPermissions,
    canDo
  };
}

// Helper types for better local inference
interface FeaturePermissions {
  view: boolean;
  edit: boolean;
  admin?: boolean;
  upload?: boolean;
}
