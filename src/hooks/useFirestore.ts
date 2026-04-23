import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';

export function useFirestore<T>(collectionName: string, options?: { teamId?: string | null, overrideUid?: string | null }) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const teamId = options?.teamId;
  const overrideUid = options?.overrideUid;

  useEffect(() => {
    const user = auth.currentUser;
    if (!user && !overrideUid) {
      setData([]);
      setLoading(false);
      return;
    }

    const effectiveUid = overrideUid || user?.uid;
    const basePath = teamId 
      ? collection(db, 'teams', teamId, collectionName) 
      : collection(db, 'users', effectiveUid!, collectionName);
    
    const q = query(basePath);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: T[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as T);
      });
      setData(items);
      setLoading(false);
    }, (err) => {
      console.error(`Firestore error in ${collectionName}:`, err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [collectionName, teamId, overrideUid]);

  const getDocPath = (id?: string) => {
    const user = auth.currentUser;
    const effectiveUid = overrideUid || user?.uid;
    if (!effectiveUid) throw new Error('User not authenticated');
    
    if (teamId) {
      return doc(db, 'teams', teamId, collectionName, id || doc(collection(db, 'teams', teamId, collectionName)).id);
    }
    return doc(db, 'users', effectiveUid, collectionName, id || doc(collection(db, 'users', effectiveUid, collectionName)).id);
  };

  const addItem = async (item: any) => {
    const docRef = getDocPath(item.id);
    await setDoc(docRef, {
      ...item,
      id: docRef.id,
      updatedAt: serverTimestamp()
    });
  };

  const updateItem = async (id: string, updates: any) => {
    await updateDoc(getDocPath(id), {
      ...updates,
      updatedAt: serverTimestamp()
    });
  };

  const deleteItem = async (id: string) => {
    await deleteDoc(getDocPath(id));
  };

  const clearCollection = async () => {
    const user = auth.currentUser;
    const effectiveUid = overrideUid || user?.uid;
    if (!effectiveUid) throw new Error('User not authenticated');
    const basePath = teamId ? collection(db, 'teams', teamId, collectionName) : collection(db, 'users', effectiveUid, collectionName);
    const snapshot = await getDocs(query(basePath));
    const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
    await Promise.all(deletePromises);
  };

  return { data, loading, error, addItem, updateItem, deleteItem, clearCollection };
}

export function useFirestoreDoc<T>(collectionName: string, docId: string, initialValue: T, options?: { teamId?: string | null, overrideUid?: string | null }) {
  const [data, setData] = useState<T>(initialValue);
  const [loading, setLoading] = useState(true);
  const teamId = options?.teamId;
  const overrideUid = options?.overrideUid;

  useEffect(() => {
    const user = auth.currentUser;
    const effectiveUid = overrideUid || user?.uid;
    if (!effectiveUid) {
      setData(initialValue);
      setLoading(false);
      return;
    }

    const docPath = teamId 
      ? doc(db, 'teams', teamId, collectionName, docId) 
      : doc(db, 'users', effectiveUid, collectionName, docId);

    const unsubscribe = onSnapshot(docPath, (docSnap) => {
      if (docSnap.exists()) {
        setData(docSnap.data() as T);
      } else {
        setData(initialValue);
      }
      setLoading(false);
    }, (err) => {
      console.error(`Firestore error in ${collectionName}/${docId}:`, err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [collectionName, docId, teamId, overrideUid]);

  const setDocData = async (newData: T) => {
    const user = auth.currentUser;
    const effectiveUid = overrideUid || user?.uid;
    if (!effectiveUid) throw new Error('User not authenticated');
    const docPath = teamId ? doc(db, 'teams', teamId, collectionName, docId) : doc(db, 'users', effectiveUid, collectionName, docId);
    
    await setDoc(docPath, {
      ...(newData as any),
      updatedAt: serverTimestamp()
    });
  };

  return { data, loading, setDocData };
}
