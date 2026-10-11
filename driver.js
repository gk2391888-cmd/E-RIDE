
import {
  signInWithPopup, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import {
  doc, getDoc, setDoc, collection, addDoc, getDocs,
  query, where, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

import { auth, db, googleProvider } from "./firebase.js";

const $ = id => document.getElementById(id);
let user = null;
let application = null;
let isOnline = false;

function message(id, text, error = false) {
  $(id).textContent = text;
  $(id).style.color = error ? "#ff8a8a" : "#28d99b";
}

function errorText(error) {
  console.error(error);
  if (error.code === "permission-denied") {
    return "Permission denied. Check Firestore rules and driver approval.";
  }
  if (error.code === "auth/unauthorized-domain") {
    return "Add this website's hostname to Firebase Authorized domains.";
  }
  return error.message || "Something went wrong.";
}

$("driver-google-login").addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    message("driver-login-message", errorText(error), true);
  }
});

$("driver-logout").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async signedInUser => {
  user = signedInUser;
  $("driver-login").hidden = !!user;
  $("driver-dashboard").hidden = !user;

  if (!user) return;

  $("driver-welcome").textContent = `Welcome, ${user.displayName || "Driver"}`;
  $("driver-account").textContent = user.email || "";

  try {
    const ref = doc(db, "driverApplications", user.uid);
    const snap = await getDoc(ref);
    application = snap.exists() ? snap.data() : null;

    if (application) {
      $("driver-name").value = application.name || user.displayName || "";
      $("driver-phone").value = application.phone || "";
      $("vehicle-type").value = application.vehicleType || "passenger";
      $("vehicle-number").value = application.vehicleNumber || "";
      $("driver-area").value = application.area || "Surajgarha, Lakhisarai";
    }

    await refreshStatus();
  } catch (error) {
    message("driver-application-message", errorText(error), true);
  }
});

$("driver-application-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!user) return;

  const button = $("driver-submit");
  button.disabled = true;

  try {
    const old = await getDoc(doc(db, "driverApplications", user.uid));

    // Never let an applicant overwrite an approved/rejected decision.
    if (old.exists() && ["approved", "rejected"].includes(old.data().status)) {
      message("driver-application-message",
        "Your application has already been reviewed. Contact the admin for changes.", true);
      return;
    }

    const phone = $("driver-phone").value.replace(/\s/g, "");
    const data = {
      uid: user.uid,
      name: $("driver-name").value.trim(),
      email: user.email || "",
      phone,
      vehicleType: $("vehicle-type").value,
      vehicleNumber: $("vehicle-number").value.trim().toUpperCase(),
      area: $("driver-area").value.trim(),
      status: "pending",
      updatedAt: serverTimestamp()
    };

    await setDoc(doc(db, "driverApplications", user.uid), {
      ...data,
      createdAt: old.exists() ? old.data().createdAt || serverTimestamp() : serverTimestamp()
    });

    application = data;
    message("driver-application-message", "Application submitted for admin verification.");
    await refreshStatus();
  } catch (error) {
    message("driver-application-message", errorText(error), true);
  } finally {
    button.disabled = false;
  }
});

async function refreshStatus() {
  if (!user) return;

  const snap = await getDoc(doc(db, "driverApplications", user.uid));
  application = snap.exists() ? snap.data() : null;

  const status = application?.status || "not registered";
  $("driver-approval-status").textContent = `Application status: ${status}`;
  $("driver-online-toggle").disabled = status !== "approved";
  $("driver-online-toggle").textContent =
    isOnline ? "Go offline" : "Go online";

  if (status === "approved") {
    await loadRequests();
  } else {
    $("driver-rides").textContent =
      "Your ride requests will be available after approval.";
  }
}

$("driver-online-toggle").addEventListener("click", () => {
  if (application?.status !== "approved") return;
  isOnline = !isOnline;
  $("driver-online-toggle").textContent = isOnline ? "Go offline" : "Go online";
  message("driver-approval-status",
    isOnline ? "You are online on this device." : "You are offline.");
});

$("driver-refresh-rides").addEventListener("click", async () => {
  try {
    await refreshStatus();
  } catch (error) {
    message("driver-approval-status", errorText(error), true);
  }
});

async function loadRequests() {
  const container = $("driver-rides");
  container.replaceChildren();

  try {
    const requests = query(
      collection(db, "rides"),
      where("status", "==", "requested")
    );
    const snapshot = await getDocs(requests);

    if (snapshot.empty) {
      container.textContent = "No new requests at the moment.";
      return;
    }

    snapshot.forEach(rideDoc => {
      const ride = rideDoc.data();
      if (!application) return;

      const supportsType =
        application.vehicleType === "both" ||
        application.vehicleType === ride.rideType;

      if (!supportsType) return;

      const card = document.createElement("article");
      card.className = "history-item";

      const route = document.createElement("strong");
      route.textContent = `${ride.pickup || "Pickup"} → ${ride.destination || "Destination"}`;

      const details = document.createElement("p");
      details.className = "driver-note";
      details.textContent =
        `${ride.rideType} · Payment preference: ${ride.paymentMethod || "cash"}`;

      const note = document.createElement("p");
      note.className = "driver-note";
      note.textContent = "Customer contact details are shown only after assignment.";

      const accept = document.createElement("button");
      accept.className = "btn btn-primary btn-full";
      accept.textContent = "Accept ride";
      accept.addEventListener("click", async () => {
        accept.disabled = true;
        try {
          // Security rules must independently verify approval and prevent
          // a second driver from accepting the same ride.
          await updateDoc(doc(db, "rides", rideDoc.id), {
            driverId: user.uid,
            driverName: application.name,
            driverPhone: application.phone,
            vehicleNumber: application.vehicleNumber,
            status: "accepted",
            acceptedAt: serverTimestamp()
          });
          await refreshStatus();
        } catch (error) {
          alert(errorText(error));
          accept.disabled = false;
        }
      });

      card.append(route, details, note, accept);
      container.appendChild(card);
    });
  } catch (error) {
    container.textContent = errorText(error);
  }
}
