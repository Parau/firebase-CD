// /src/onUserCreate.js
//const functions = require('firebase-functions');
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

// Ensure Firebase Admin is initialized
if (!admin.apps.length) {
  admin.initializeApp();
}


exports.onUserCreated = functions.auth.user().onCreate(async (user) => {
  // Validação inicial
  if (!user) {
    console.error('Evento disparado sem dados do usuário');
    return;
  }

  const uid = user.uid;
  const email = user.email;
  const displayName = user.displayName || 'Anonymous';

  // Reference to the users collection in Firestore
  const usersRef = admin.firestore().collection('CDUsers');

  try {
    // Check if an email already exists
    const snapshot = await usersRef.where('email', '==', email).get();
    
    if (!snapshot.empty) {
      // Email already exists, update the existing user's UID and timestamp
      const userDoc = snapshot.docs[0]; // Get the first matched document
      
      await usersRef.doc(userDoc.id).update({
        uid: uid, // Update the existing record with the new UID
        updatedAt: admin.firestore.FieldValue.serverTimestamp() // Add update timestamp
      });

      console.log(`User with email ${email} already exists. Updated UID.`);
    } else {
      // Email doesn't exist, create a new user entry
      await usersRef.doc(uid).set({
        email: email,
        displayName: displayName,
        uid: uid, // Store the authenticated user's UID
        createdAt: admin.firestore.FieldValue.serverTimestamp() // Add creation timestamp
      });

      console.log(`New user created with UID ${uid}.`);
    }
  } catch (error) {
    console.error("Error processing user creation:", error);
    throw error; // Propagar o erro para o Firebase Functions
  }
});
