const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Ensure Firebase Admin is initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

// HTTPS callable function to return the user's book codes and expiry dates
exports.getUserBookCodes = functions.https.onCall(async (data, context) => {
  // List of allowed domains
  const allowedDomains = ['https://your-allowed-domain.com']; // Include localhost for development

  // Get the origin of the request
  const origin = context.rawRequest.headers.origin;

  // Log the origin for debugging purposes
  console.log('Request originated from:', origin);

  // Check if the origin is allowed
  if (!allowedDomains.includes(origin)) {
    throw new functions.https.HttpsError('permission-denied', 'Requests from this domain are not allowed.');
  }

  // If the request is from localhost, check for a specific parameter
  if (origin.includes('localhost')) {
    const devId = data.devId; // Extract the parameter from the request data
    const expectedDevId = 'your-expected-dev-id'; // Replace with your expected ID

    // Validate the devId
    if (devId !== expectedDevId) {
      throw new functions.https.HttpsError('permission-denied', 'Invalid development ID');
    }
  }

  // Validate that the user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const uid = data.uid || context.auth.uid; // Use passed UID or authenticated user's UID

  try {
    // Get user's document from Firestore
    const userRef = admin.firestore().collection('CDUsers').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User data not found');
    }

    const userData = userDoc.data();

    // Return the book codes and expiry dates
    return {
      uid: uid,
      bookCodes: userData.bookCodes || []
    };

  } catch (error) {
    console.error(`Error fetching book codes for UID: ${uid}`, error);
    throw new functions.https.HttpsError('internal', 'Unable to fetch user book codes');
  }
});
