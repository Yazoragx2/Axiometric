import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  sendEmailVerification,
  reload,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { motion } from 'motion/react';

const TOS_TEXT = `Welcome to VA Session Manager (the "Service"), a platform designed for Virtual Assistants to manage their professional development, work sessions, and competency tracking. By accessing or using our Service, you agree to be bound by these Terms of Service.

1. User Accounts: You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account.

2. Use of Service: You agree to use the Service only for lawful purposes and in accordance with these Terms. You are prohibited from using the Service to transmit any malicious code or engage in any activity that interferes with the performance of the Service.

3. Data Ownership & AI Improvement: You retain all rights and ownership to the data you input into the Service. By using the Service, you grant Axiometric a non-exclusive, worldwide, royalty-free license to host, store, and process your data solely for the purpose of providing the Service to you. Furthermore, you acknowledge that anonymized interaction data and feedback may be used to improve our internal AI models and framework logic.

4. AI Services: The Service utilizes the Claude API system (provided by Anthropic) for its intelligent features. Your interactions with the AI are subject to both these terms and the data processing standards of our API providers.

5. Intellectual Property: The Service and its original content, features, and functionality are and will remain the exclusive property of Axiometric. Our trademarks and trade dress may not be used in connection with any product or service without our prior written consent.

6. Limitation of Liability: In no event shall Axiometric be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or in connection with your use of the Service.

7. Changes to Terms: We reserve the right to modify these terms at any time. We will provide notice of any significant changes by posting the new terms on this page.`;

const CPC_TEXT = `Axiometric ("we," "our," or "us") is committed to protecting your privacy and respecting intellectual property rights.

1. Information Collection: We collect minimal personal information, specifically your email address, for the sole purpose of authentication and account management. Interaction data with the Axiometric AI is collected to facilitate self-improvement of the framework's intelligence.

2. Data Isolation & AI Processing: Your data is stored securely using industry-standard encryption and is logically isolated from other users' data. AI processing is performed via the Claude API (Anthropic); data sent to the API is governed by their privacy standards for API users.

3. Copyright Policy: All software, design, and original content within the VA Session Manager are protected by copyright laws. Users are granted a limited, non-transferable license to use the Service for personal or professional management. Unauthorized reproduction or distribution of the Service's code or design is strictly prohibited.

4. Cookies: We use essential session cookies to maintain your authenticated state. These cookies do not track your activity on other websites.

5. Data Security: We utilize Firebase (a Google Cloud platform) to ensure high-level security for your data. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.`;

import { Logo } from './Logo';

interface AuthProps {
  onAuthenticated: (user: any) => void;
}

export function Auth({ onAuthenticated }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTOS, setAcceptedTOS] = useState(false);
  const [acceptedCPC, setAcceptedCPC] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);

  // Polling for verification status
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (auth.currentUser && !auth.currentUser.emailVerified && !isVerified) {
      interval = setInterval(async () => {
        try {
          await reload(auth.currentUser!);
          if (auth.currentUser?.emailVerified) {
            setIsVerified(true);
            onAuthenticated(auth.currentUser);
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [auth.currentUser, isVerified, onAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Check if user exists in Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (userDoc.exists()) {
          if (user.emailVerified) {
            onAuthenticated(user);
          } else {
            // Verification required screen will show
            setVerificationSent(true);
          }
        } else {
          setError('User profile not found. Please contact support.');
          await signOut(auth);
        }
      } else {
        if (!acceptedTOS || !acceptedCPC) {
          setError('You must accept the Terms of Service and Privacy Policy.');
          setLoading(false);
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // ActionCodeSettings can help with delivery and redirection
        const actionCodeSettings = {
          url: window.location.href,
          handleCodeInApp: true,
        };

        await sendEmailVerification(user, actionCodeSettings);
        setVerificationSent(true);

        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          acceptedTOS: true,
          acceptedCPC: true,
          tosAcceptedAt: new Date().toISOString(),
          cpcAcceptedAt: new Date().toISOString(),
          role: 'member'
        });

        // Don't call onAuthenticated yet, let them verify
      }
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('This email identity is already established in our records.');
      } else if (err.code === 'auth/weak-password') {
        setError('Security key is too weak. Minimum 6 characters required.');
      } else if (err.code === 'auth/invalid-email') {
        setError('The provided email identity format is invalid.');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid credentials. Access denied.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Identity locked temporarily.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (auth.currentUser && (!auth.currentUser.emailVerified || isVerified)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ 
            width: '100%',
            maxWidth: 420, 
            padding: '48px 40px', 
            background: 'var(--bg-surface)', 
            border: '1px solid var(--border-default)', 
            borderRadius: 12, 
            boxShadow: '0 32px 64px -12px rgba(0,0,0,0.5)',
            textAlign: 'center'
          }}
        >
          <div style={{ marginBottom: 32 }}>
            <div style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              width: 64, 
              height: 64, 
              borderRadius: 12, 
              background: isVerified ? 'rgba(77, 217, 172, 0.1)' : 'var(--accent-dim)', 
              border: isVerified ? '1px solid rgba(77, 217, 172, 0.2)' : '1px solid var(--accent-muted)',
              marginBottom: 24,
              color: isVerified ? '#4dd9ac' : 'var(--accent)'
            }}>
              {isVerified ? (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              ) : (
                <Logo size={40} />
              )}
            </div>
            
            <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.15em', marginBottom: 12, textTransform: 'uppercase' }}>
              {isVerified ? 'Identity Verified' : 'Verification Required'}
            </h1>
            
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {isVerified ? (
                'Your professional identity has been successfully established. Initializing framework access...'
              ) : (
                <>
                  A secure activation link has been dispatched to:<br/>
                  <strong style={{ color: 'var(--text-primary)' }}>{auth.currentUser.email}</strong>
                </>
              )}
            </p>
          </div>

          {!isVerified && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: '12px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 11 }}>
                  <div className="pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
                  MONITORING ACTIVATION STATUS...
                </div>
              </div>

              <button 
                className="btn-primary" 
                onClick={async () => {
                  setLoading(true);
                  setError('');
                  try {
                    await reload(auth.currentUser!);
                    if (auth.currentUser?.emailVerified) {
                      setIsVerified(true);
                      setTimeout(() => onAuthenticated(auth.currentUser), 1500);
                    } else {
                      setError('Activation not yet detected. Please ensure you have clicked the link in your email.');
                    }
                  } catch (err: any) {
                    setError(err.message);
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                style={{ width: '100%', height: 44 }}
              >
                {loading ? 'SYNCHRONIZING...' : 'MANUAL SYNC'}
              </button>
              
              <button 
                className="btn-secondary" 
                onClick={async () => {
                  setLoading(true);
                  setError('');
                  try {
                    const actionCodeSettings = {
                      url: window.location.href,
                      handleCodeInApp: true,
                    };
                    await sendEmailVerification(auth.currentUser!, actionCodeSettings);
                    setError('A fresh activation link has been dispatched.');
                  } catch (err: any) {
                    if (err.code === 'auth/too-many-requests') {
                      setError('Please wait a moment before requesting another link.');
                    } else {
                      setError(err.message);
                    }
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                style={{ width: '100%', height: 44 }}
              >
                RESEND ACTIVATION LINK
              </button>

              <button 
                onClick={() => signOut(auth)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, marginTop: 12, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Return to Login
              </button>

              <button 
                onClick={() => setShowTroubleshooting(!showTroubleshooting)}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, marginTop: 24, cursor: 'pointer', opacity: 0.7 }}
              >
                {showTroubleshooting ? 'HIDE TROUBLESHOOTING' : 'NOT RECEIVING THE EMAIL?'}
              </button>

              {showTroubleshooting && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  style={{ marginTop: 16, textAlign: 'left', background: 'var(--bg-base)', padding: '16px', borderRadius: 8, border: '1px solid var(--border-subtle)', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}
                >
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>TROUBLESHOOTING STEPS:</strong>
                  <ul style={{ paddingLeft: 16, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <li>Check your <strong>Spam</strong> or <strong>Junk</strong> folder.</li>
                    <li>Ensure <strong>{auth.currentUser.email}</strong> is correct.</li>
                    <li>Wait up to 5 minutes for delivery.</li>
                    <li>
                      <strong>Critical (For Admins):</strong> Ensure the domain 
                      <code style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 4px', borderRadius: 3, margin: '0 4px', color: 'var(--accent)' }}>
                        {window.location.hostname}
                      </code> 
                      is added to the <strong>Authorized Domains</strong> in your Firebase Console (Auth &gt; Settings).
                    </li>
                  </ul>
                </motion.div>
              )}
            </div>
          )}

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ marginTop: 20, color: 'var(--status-amber)', fontSize: 12, background: 'rgba(240, 160, 75, 0.1)', padding: 10, borderRadius: 6, border: '1px solid rgba(240, 160, 75, 0.2)', lineHeight: 1.4 }}
            >
              {error}
            </motion.div>
          )}
        </motion.div>
      </div>
    );
  }

  if (showTerms) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="auth-container" 
        style={{ maxWidth: 600, padding: 40, margin: '40px auto', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Logo size={24} />
            <h2 style={{ color: 'var(--text-accent)', fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>LEGAL AGREEMENTS</h2>
          </div>
          <button onClick={() => setShowTerms(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20 }}>×</button>
        </div>
        
        <div style={{ height: 400, overflowY: 'auto', background: 'var(--bg-base)', padding: 24, borderRadius: 4, marginBottom: 24, fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
          <h3 style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Terms of Service</h3>
          <div style={{ whiteSpace: 'pre-wrap', marginBottom: 32 }}>{TOS_TEXT}</div>
          
          <h3 style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, marginBottom: 12, paddingTop: 24, borderTop: '1px solid var(--border-subtle)' }}>Copyright & Privacy Policy</h3>
          <div style={{ whiteSpace: 'pre-wrap' }}>{CPC_TEXT}</div>
        </div>
        
        <button className="btn-primary" onClick={() => setShowTerms(false)} style={{ width: '100%' }}>
          I HAVE READ THE AGREEMENTS
        </button>
      </motion.div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="auth-container" 
        style={{ 
          width: '100%',
          maxWidth: 420, 
          padding: '48px 40px', 
          background: 'var(--bg-surface)', 
          border: '1px solid var(--border-default)', 
          borderRadius: 12, 
          boxShadow: '0 32px 64px -12px rgba(0,0,0,0.5)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, var(--accent), transparent)' }} />
        
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            width: 64, 
            height: 64, 
            borderRadius: 12, 
            background: 'var(--bg-base)', 
            border: '1px solid var(--border-default)',
            marginBottom: 20,
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
          }}>
            <Logo size={40} />
          </div>
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.15em', marginBottom: 8, textTransform: 'uppercase' }}>
            Axiometric
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            {isLogin ? 'SECURE ACCESS GATEWAY' : 'CREATE PROFESSIONAL IDENTITY'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Identity (Email)
            </label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              placeholder="name@example.com"
              style={{ height: 42 }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Security Key (Password)
            </label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              placeholder="••••••••"
              style={{ height: 42 }}
            />
          </div>

          {!isLogin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 4, padding: '16px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <label style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 12, alignItems: 'start', fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <input 
                  type="checkbox" 
                  checked={acceptedTOS} 
                  onChange={(e) => setAcceptedTOS(e.target.checked)} 
                  style={{ width: 16, height: 16, marginTop: 1, cursor: 'pointer' }}
                />
                <span style={{ lineHeight: 1.4 }}>
                  I acknowledge the <button type="button" onClick={() => setShowTerms(true)} style={{ background: 'none', border: 'none', color: 'var(--accent)', padding: 0, textDecoration: 'underline', cursor: 'pointer', fontWeight: 500 }}>Terms of Service</button>
                </span>
              </label>
              <label style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 12, alignItems: 'start', fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <input 
                  type="checkbox" 
                  checked={acceptedCPC} 
                  onChange={(e) => setAcceptedCPC(e.target.checked)} 
                  style={{ width: 16, height: 16, marginTop: 1, cursor: 'pointer' }}
                />
                <span style={{ lineHeight: 1.4 }}>
                  I accept the Privacy & Copyright Policy
                </span>
              </label>
            </div>
          )}

          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              style={{ color: 'var(--status-red)', fontSize: 12, textAlign: 'center', background: 'rgba(224, 92, 106, 0.1)', border: '1px solid rgba(224, 92, 106, 0.2)', padding: '10px 12px', borderRadius: 6, lineHeight: 1.4 }}
            >
              {error}
            </motion.div>
          )}

          <button className="btn-primary" type="submit" disabled={loading} style={{ height: 44, fontSize: 13, marginTop: 8 }}>
            {loading ? 'SYNCHRONIZING...' : (isLogin ? 'INITIALIZE SESSION' : 'ESTABLISH IDENTITY')}
          </button>
        </form>

        <div style={{ marginTop: 32, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
          {isLogin ? "New to the framework?" : "Already established?"}{' '}
          <button 
            onClick={() => setIsLogin(!isLogin)} 
            style={{ background: 'none', border: 'none', color: 'var(--accent)', padding: 0, cursor: 'pointer', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}
          >
            {isLogin ? 'Create Account' : 'Login'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
