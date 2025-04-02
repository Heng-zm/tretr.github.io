// public/firebase-messaging-sw.js

// Import the Firebase scripts that you need
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

// Initialize the Firebase app in the service worker
// Replace with your project's config object
// **SECURITY NOTE:** It's generally recommended to load config from a secure source,
// but for simplicity in this example, we hardcode it. Be aware of the implications.
const firebaseConfig = {
    apiKey: "AIzaSyBU_Q2F0zIMTrIyh5nXERtU3fEtlSX4SH0", // REPLACE
    authDomain: "mystical-slate-448113-c6.firebaseapp.com", // REPLACE
    projectId: "mystical-slate-448113-c6", // REPLACE
    storageBucket: "mystical-slate-448113-c6.firebasestorage.app", // REPLACE
    messagingSenderId: "681914071632", // REPLACE
    appId: "1:681914071632:web:35d31b8d1dafb51d51ef55", // REPLACE
    measurementId: "G-HQSH8R6RF9" // REPLACE (Optional)
};

firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging so that it can handle background messages.
const messaging = firebase.messaging();

// Handle incoming messages when the app is not in the foreground
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  // Customize notification here
  const notificationTitle = payload.notification?.title || 'New Message';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: payload.notification?.icon || '/icons/icon-192x192.png' // Optional: path to an icon
    // You can add more options: image, actions, data, etc.
    // data: payload.data // Attach custom data if sent from Function
  };

  // Show the notification
  // Use the tag option to prevent duplicate notifications for the same chat/message
  // notificationOptions.tag = payload.data?.messageId || 'new-message';

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Optional: Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click Received.', event.notification);

  event.notification.close();

  // Example: Focus or open a specific client window/tab
  // This requires more complex logic to find the right client or open a new one
  // const targetUrl = event.notification.data?.click_action || '/'; // Get URL from data if provided
  // event.waitUntil(
  //   clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
  //     for (const client of clientList) {
  //       if (client.url === targetUrl && 'focus' in client) {
  //         return client.focus();
  //       }
  //     }
  //     if (clients.openWindow) {
  //       return clients.openWindow(targetUrl);
  //     }
  //   })
  // );
});
