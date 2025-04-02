// functions/index.js
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

// --- Basic Content Moderation Function ---
// List of bad words (simple example, use a more robust list/service in production)
const BLOCKLIST = ["badword", "curse", "inappropriate", "spammy"]; // Add your blocked words here

exports.moderateMessage = functions.firestore
    .document("messages/{messageId}")
    .onCreate(async (snap, context) => {
      const messageData = snap.data();

      // Don't moderate non-text messages or already flagged messages
      if (!messageData || !messageData.text || messageData.isFlagged) {
        console.log("Skipping moderation for non-text or already flagged message.");
        return null;
      }

      const messageText = messageData.text.toLowerCase(); // Check in lowercase
      let isBlocked = false;

      for (const word of BLOCKLIST) {
        if (messageText.includes(word)) {
          isBlocked = true;
          break; // Found a blocked word, no need to check further
        }
      }

      if (isBlocked) {
        console.log(`Moderating message ${context.params.messageId} due to blocked word.`);
        // Update the message: mark as flagged and overwrite text
        return snap.ref.update({
          text: "[Content Blocked by Moderation]",
          isFlagged: true,
        });
      }

      return null; // No blocked words found
    });


// --- Send Chat Notification Function ---
exports.sendChatNotification = functions.firestore
    .document("messages/{messageId}")
    .onCreate(async (snap, context) => {
      const newMessage = snap.data();

      // Exit if message is flagged by moderation or has no sender
      if (!newMessage || newMessage.isFlagged || !newMessage.senderId) {
        console.log("Skipping notification for flagged message or message without sender.");
        return null;
      }

      const senderId = newMessage.senderId;
      const senderName = newMessage.senderName || "Someone";
      let messageText = newMessage.text || "";

      // Handle location messages
      if(newMessage.location){
          messageText = "Shared their location📍";
      }

      // Truncate long messages for notification
      if (messageText.length > 100) {
        messageText = messageText.substring(0, 97) + "...";
      }

      // --- Fetch user tokens ---
      // 1. Get all users (or users in the same room if you implement rooms)
      //    This can be inefficient for many users. Consider targeting specific users (mentions).
      const usersSnapshot = await db.collection("users").get();
      if (usersSnapshot.empty) {
        console.log("No users found to notify.");
        return null;
      }

      const tokens = [];
      usersSnapshot.forEach((doc) => {
        const user = doc.data();
        // Add tokens for users OTHER THAN the sender, if they have tokens
        if (doc.id !== senderId && user.fcmTokens && Array.isArray(user.fcmTokens)) {
           tokens.push(...user.fcmTokens); // Add all tokens from the user's array
        }
      });

      if (tokens.length === 0) {
        console.log("No valid tokens found for recipients.");
        return null;
      }

      // --- Construct Notification Payload ---
      const payload = {
        notification: {
          title: `${senderName} sent a message`,
          body: messageText,
          // Optional: Add icon, click action, etc.
          // icon: "/icons/icon-96x96.png",
          // click_action: `https://your-app-url.com/chat` // URL to open on click
        },
        // Optional: Send custom data (can be received in SW/client)
        // data: {
        //   messageId: context.params.messageId,
        //   senderId: senderId,
        // }
      };

      // --- Send Notifications ---
      console.log(`Sending notification to ${tokens.length} token(s).`);
      try {
        const response = await admin.messaging().sendToDevice(tokens, payload);

        // --- Cleanup invalid tokens (Optional but recommended) ---
        const tokensToRemove = [];
        response.results.forEach((result, index) => {
          const error = result.error;
          if (error) {
            console.error("Failure sending notification to", tokens[index], error);
            // Cleanup the tokens who are not registered anymore.
            if (error.code === "messaging/invalid-registration-token" ||
                error.code === "messaging/registration-token-not-registered") {
              tokensToRemove.push( tokens[index] ); // Mark token for removal
            }
          }
        });

        // Perform cleanup (find users associated with these tokens and remove)
        if (tokensToRemove.length > 0) {
          console.log("Cleaning up invalid tokens:", tokensToRemove);
          // This cleanup logic can be complex. Find users with these tokens and remove them.
          // Example (simplified, might need optimization):
           const cleanupPromises = usersSnapshot.docs.map(async (userDoc) => {
               const userData = userDoc.data();
               if(userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
                  const userTokens = userData.fcmTokens;
                  const validTokens = userTokens.filter(token => !tokensToRemove.includes(token));
                   // If tokens changed, update the user document
                   if(validTokens.length !== userTokens.length){
                       return userDoc.ref.update({ fcmTokens: validTokens });
                   }
               }
               return Promise.resolve();
           });
           await Promise.all(cleanupPromises);
           console.log("Finished cleaning tokens.");
        }
        // --- End Token Cleanup ---

        return response;

      } catch (error) {
        console.error("Error sending FCM message:", error);
        return null;
      }
    });
