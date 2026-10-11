
import {
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

import { auth, db, googleProvider } from "./firebase.js";

const $ = (id) => document.getElementById(id);

const welcome = $("welcome");
const appPanel = $("app-panel");
const loginMessage = $("login-message");
const bookingMessage = $("booking-message");
const bookingForm = $("booking-form");
const rideHistory = $("ride-history");

let currentUser = null;
let selectedRide = "passenger";
let pickupCoordinates = null;

$("year").textContent = new Date().getFullYear();

function showMessage(element, message, isError = false) {
  element.textContent = message;
  element.style.color = isError ? "#ff8a8a" : "#28d99b";
}

function readableError(error) {
  const messages = {
    "auth/unauthorized-domain":
      "This website domain is not authorized in Firebase Authentication settings.",
    "auth/popup-blocked":
      "Google login popup was blocked. Allow popups and try again.",
    "auth/popup-closed-by-user":
      "Login was cancelled. Please try again.",
    "permission-denied":
      "Firestore permission denied. Check your published Firestore rules.",
    "unavailable":
      "Service temporarily unavailable. Check your internet and retry."
  };

  return messages[error.code] ||
    error.message ||
    "Something went wrong. Please try again.";
}

$("google-login").addEventListener("click", async () => {
  const button = $("google-login");
  button.disabled = true;
  showMessage(loginMessage, "Opening Google sign-in…");

  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error("Google sign-in error:", error);
    showMessage(loginMessage, readableError(error), true);
  } finally {
    button.disabled = false;
  }
});

$("logout").addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error(error);
    alert(readableError(error));
  }
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (!user) {
    welcome.hidden = false;
    appPanel.hidden = true;
    return;
  }

  try {
    const profileRef = doc(db, "users", user.uid);
    const profileSnap = await getDoc(profileRef);

    if (!profileSnap.exists()) {
      await setDoc(profileRef, {
        uid: user.uid,
        name: user.displayName || "E RIDE User",
        email: user.email || "",
        photoURL: user.photoURL || "",
        role: "customer",
        createdAt: serverTimestamp()
      });
    }

    $("user-name").textContent = user.displayName || "E RIDE User";
    $("user-email").textContent = user.email || "";

    const photo = $("user-photo");
    if (user.photoURL) {
      photo.src = user.photoURL;
      photo.hidden = false;
    } else {
      photo.removeAttribute("src");
      photo.alt = "No profile photo";
    }

    welcome.hidden = true;
    appPanel.hidden = false;
    showMessage(loginMessage, "");
    await loadRideHistory();
  } catch (error) {
    console.error("Profile setup error:", error);
    showMessage(loginMessage, readableError(error), true);
    welcome.hidden = false;
    appPanel.hidden = true;
  }
});

document.querySelectorAll(".ride-option").forEach((button) => {
  button.addEventListener("click", () => {
    selectedRide = button.dataset.ride;

    document.querySelectorAll(".ride-option").forEach((item) => {
      item.classList.toggle("selected", item === button);
    });

    $("cargo-details").hidden = selectedRide !== "cargo";
    $("goods").required = selectedRide === "cargo";
  });
});

$("get-location").addEventListener("click", () => {
  if (!navigator.geolocation) {
    showMessage(bookingMessage, "GPS is not supported by this browser.", true);
    return;
  }

  const button = $("get-location");
  button.disabled = true;
  showMessage(bookingMessage, "Getting your location…");

  navigator.geolocation.getCurrentPosition(
    (position) => {
      pickupCoordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };

      $("pickup").value =
        `GPS location (${pickupCoordinates.latitude.toFixed(5)}, ${pickupCoordinates.longitude.toFixed(5)})`;

      showMessage(bookingMessage, "GPS pickup captured.");
      button.disabled = false;
    },
    (error) => {
      console.error("GPS error:", error);
      pickupCoordinates = null;

      const messages = {
        1: "Location permission denied. Allow location access or enter pickup manually.",
        2: "Your location could not be determined. Try again or enter it manually.",
        3: "Location request timed out. Try again."
      };

      showMessage(
        bookingMessage,
        messages[error.code] || "Could not get your location.",
        true
      );
      button.disabled = false;
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
  );
});

$("pickup").addEventListener("input", () => {
  pickupCoordinates = null;
});

bookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser) {
    showMessage(bookingMessage, "Please sign in first.", true);
    return;
  }

  const pickup = $("pickup").value.trim();
  const destination = $("destination").value.trim();
  const goods = $("goods").value.trim();
  const paymentMethod =
    bookingForm.querySelector('input[name="payment"]:checked')?.value;

  if (!pickup || !destination) {
    showMessage(bookingMessage, "Enter both pickup and destination.", true);
    return;
  }

  if (selectedRide === "cargo" && !goods) {
    showMessage(bookingMessage, "Please describe the goods.", true);
    return;
  }

  if (!["cash", "upi"].includes(paymentMethod)) {
    showMessage(bookingMessage, "Choose a valid payment preference.", true);
    return;
  }

  const button = $("book-ride");
  button.disabled = true;
  button.textContent = "Submitting…";

  try {
    const ride = {
      customerId: currentUser.uid,
      customerName: currentUser.displayName || "E RIDE User",
      rideType: selectedRide,
      pickup,
      destination,
      paymentMethod,
      status: "requested",
      createdAt: serverTimestamp()
    };

    if (pickupCoordinates) {
      ride.pickupCoordinates = pickupCoordinates;
    }

    if (selectedRide === "cargo") {
      ride.goodsDescription = goods;
    }

    const rideRef = await addDoc(collection(db, "rides"), ride);

    showMessage(
      bookingMessage,
      `Request submitted. Reference: ${rideRef.id.slice(0, 8)}. Driver matching is not connected yet.`
    );

    bookingForm.reset();
    pickupCoordinates = null;
    selectedRide = "passenger";
    $("cargo-details").hidden = true;
    $("goods").required = false;

    document.querySelectorAll(".ride-option").forEach((item) => {
      item.classList.toggle("selected", item.dataset.ride === "passenger");
    });

    await loadRideHistory();
  } catch (error) {
    console.error("Ride booking error:", error);
    showMessage(bookingMessage, readableError(error), true);
  } finally {
    button.disabled = false;
    button.textContent = "Request a ride →";
  }
});

$("refresh-rides").addEventListener("click", loadRideHistory);

async function loadRideHistory() {
  if (!currentUser) return;

  rideHistory.replaceChildren();

  const loading = document.createElement("p");
  loading.className = "muted";
  loading.textContent = "Loading rides…";
  rideHistory.appendChild(loading);

  try {
    const ridesQuery = query(
      collection(db, "rides"),
      where("customerId", "==", currentUser.uid),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(ridesQuery);
    rideHistory.replaceChildren();

    if (snapshot.empty) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "No rides yet. Your ride requests will appear here.";
      rideHistory.appendChild(empty);
      return;
    }

    snapshot.forEach((rideDoc) => {
      const ride = rideDoc.data();
      const item = document.createElement("article");
      item.className = "history-item";

      const route = document.createElement("div");
      route.className = "history-route";
      route.textContent = `${ride.pickup || "Pickup"} → ${ride.destination || "Destination"}`;

      const meta = document.createElement("div");
      meta.className = "history-meta";

      const details = document.createElement("span");
      details.textContent =
        `${ride.rideType === "cargo" ? "📦 Cargo" : "🛺 Passenger"} · ${(ride.paymentMethod || "cash").toUpperCase()}`;

      const status = document.createElement("span");
      status.className = "status";
      status.textContent = ride.status || "requested";

      meta.append(details, status);
      item.append(route, meta);
      rideHistory.appendChild(item);
    });
  } catch (error) {
    console.error("Ride history error:", error);
    rideHistory.replaceChildren();

    const message = document.createElement("p");
    message.className = "message";
    message.textContent = readableError(error);
    rideHistory.appendChild(message);
  }
}

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  });
}
