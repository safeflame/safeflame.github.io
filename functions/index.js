/* SafeFlame AI: owner-only Cloud Function.
   adminSetPassword({ email, password }) lets an owner set another admin's password directly.
   Browsers cannot do this safely, so it runs here with the Firebase Admin SDK. */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
admin.initializeApp();

const HARD_OWNERS = ['admin@safeflame.github.io', 'chrisbenmartink24@gmail.com'];   // keep in step with firestore.rules
const lc = s => String(s || '').trim().toLowerCase();

exports.adminSetPassword = onCall(async (req) => {
  const caller = lc(req.auth && req.auth.token && req.auth.token.email);
  if (!caller) throw new HttpsError('unauthenticated', 'Sign in first.');
  const db = admin.firestore();
  const cfg = (await db.doc('adminRoles/config').get()).data() || {};
  const owners = (cfg.owners || []).map(lc);
  const callerIsOwner = HARD_OWNERS.includes(caller) || owners.includes(caller);
  if (!callerIsOwner) throw new HttpsError('permission-denied', 'Only owners can change another admin\u2019s password.');

  const email = lc(req.data && req.data.email), password = String((req.data && req.data.password) || '');
  if (!email) throw new HttpsError('invalid-argument', 'Missing email.');
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) throw new HttpsError('invalid-argument', 'Use at least 8 characters with a letter and a number.');

  // the target must be an admin, and only a fixed owner may change a fixed owner
  const list = ((await db.doc('settings/admins').get()).data() || {}).emails || [];
  const targetIsAdmin = HARD_OWNERS.includes(email) || list.map(lc).includes(email);
  if (!targetIsAdmin) throw new HttpsError('failed-precondition', 'That email is not on the admin list.');
  if (HARD_OWNERS.includes(email) && !HARD_OWNERS.includes(caller)) throw new HttpsError('permission-denied', 'Only a fixed owner can change a fixed owner\u2019s password.');

  let user;
  try { user = await admin.auth().getUserByEmail(email); }
  catch (e) { throw new HttpsError('not-found', 'No sign-in account exists for that email.'); }
  await admin.auth().updateUser(user.uid, { password });
  await admin.auth().revokeRefreshTokens(user.uid);          // signs them out everywhere
  await db.collection('adminLog').add({ at: Date.now(), by: caller, action: 'admin.setpw', target: email, detail: 'password set by owner (function)' }).catch(() => {});
  return { ok: true };
});
