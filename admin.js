
import {
  signInWithPopup, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import {
  collection, getDocs, doc, updateDoc,
  query, where, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

import { auth, db, googleProvider } from "./firebase.js";

const $ = id => document.getElementById(id);
let adminUser = null;

function say(id, text, error = false) {
  $(id).textContent = text;
  $(id).style.color = error ? "#ff9a9a" : "#28d99b";
}

function node(tag, text, className = "") {
  const el = document.createElement(tag);
  el.textContent = text;
  if (className) el.className = className;
  return el;
}

function explain(error) {
  console.error(error);
  if (error.code === "permission-denied") {
    return "Permission denied. Confirm admin custom claim and Firestore rules.";
  }
  return error.message || "An error occurred.";
}

$("admin-google-login").addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    say("admin-login-message", explain(error), true);
  }
});

$("admin-logout").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async user => {
  adminUser = user;

  if (!user) {
    $("admin-login").hidden = false;
    $("admin-dashboard").hidden = true;
    $("admin-logout").hidden = true;
    return;
  }

  try {
    const token = await user.getIdTokenResult(true);

    if (token.claims.admin !== true) {
      $("admin-login").hidden = false;
      $("admin-dashboard").hidden = true;
      $("admin-logout").hidden = false;
      say(
        "admin-login-message",
        "Access denied: this Google account has no trusted admin claim. Sign out and use an authorized admin account.",
        true
      );
      return;
    }

    $("admin-login").hidden = true;
    $("admin-dashboard").hidden = false;
    $("admin-logout").hidden = false;
    $("admin-identity").textContent = `Signed in as ${user.email || user.uid}`;

    await refreshDashboard();
  } catch (error) {
    say("admin-login-message", explain(error), true);
  }
});

document.querySelectorAll(".admin-tabs button").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".admin-tabs button").forEach(item =>
      item.classList.toggle("active", item === button)
    );

    $("applications-view").hidden = button.dataset.view !== "applications";
    $("rides-view").hidden = button.dataset.view !== "rides";
  });
});

$("admin-refresh").addEventListener("click", refreshDashboard);

async function refreshDashboard() {
  if (!adminUser) return;

  say("admin-message", "Loading dashboard…");

  try {
    const [applications, rides] = await Promise.all([
      getDocs(collection(db, "driverApplications")),
      getDocs(query(
        collection(db, "rides"),
        orderBy("createdAt", "desc"),
        limit(100)
      ))
    ]);

    let pending = 0;
    let approved = 0;

    $("admin-applications").replaceChildren();
    $("admin-rides").replaceChildren();

    applications.forEach(snapshot => {
      const data = snapshot.data();

      if (data.status === "pending") pending++;
      if (data.status === "approved") approved++;

      const card = node("article", "", "admin-card");
      card.append(node("h3", data.name || "Unnamed driver"));
      card.append(node("p", `Email: ${data.email || "Not supplied"}`, "admin-meta"));
      card.append(node("p", `Phone: ${data.phone || "Not supplied"}`, "admin-meta"));
      card.append(node("p", `Vehicle: ${data.vehicleNumber || "Not supplied"}`, "admin-meta"));
      card.append(node("p", `Type: ${data.vehicleType || "Not supplied"}`, "admin-meta"));
      card.append(node("p", `Area: ${data.area || "Not supplied"}`, "admin-meta"));
      card.append(node("p", `Status: ${data.status || "unknown"}`, "admin-meta"));

      if (data.status === "pending") {
        const actions = node("div", "", "admin-actions");
        const approve = node("button", "Approve", "btn btn-primary");
        const reject = node("button", "Reject", "btn btn-danger");

        approve.addEventListener("click", () =>
          reviewApplication(snapshot.id, "approved", approve, reject)
        );
        reject.addEventListener("click", () =>
          reviewApplication(snapshot.id, "rejected", approve, reject)
        );

        actions.append(approve, reject);
        card.append(actions);
      }

      $("admin-applications").append(card);
    });

    rides.forEach(snapshot => {
      const ride = snapshot.data();
      const card = node("article", "", "admin-card");
      card.append(node("h3", `${ride.pickup || "Pickup"} → ${ride.destination || "Destination"}`));
      card.append(node("p", `Ride ID: ${snapshot.id}`, "admin-meta"));
      card.append(node("p", `Type: ${ride.rideType || "unknown"}`, "admin-meta"));
      card.append(node("p", `Payment: ${ride.paymentMethod || "unknown"}`, "admin-meta"));
      card.append(node("p", `Status: ${ride.status || "unknown"}`, "admin-meta"));
      card.append(node("p", `Customer ID: ${ride.customerId || "unknown"}`, "admin-meta"));
      card.append(node("p", `Driver ID: ${ride.driverId || "Not assigned"}`, "admin-meta"));
      $("admin-rides").append(card);
    });

    $("stat-pending").textContent = pending;
    $("stat-approved").textContent = approved;
    $("stat-rides").textContent = rides.size;

    if (applications.empty) {
      $("admin-applications").append(node("p", "No driver applications yet.", "admin-meta"));
    }
    if (rides.empty) {
      $("admin-rides").append(node("p", "No rides found.", "admin-meta"));
    }

    say("admin-message", "Dashboard refreshed.");
  } catch (error) {
    say("admin-message", explain(error), true);
  }
}

async function reviewApplication(uid, status, approve, reject) {
  if (!adminUser) return;

  if (!confirm(`${status === "approved" ? "Approve" : "Reject"} this driver application?`)) {
    return;
  }

  approve.disabled = true;
  reject.disabled = true;

  try {
    await updateDoc(doc(db, "driverApplications", uid), {
      status,
      reviewedAt: serverTimestamp(),
      reviewedBy: adminUser.uid
    });

    say("admin-message", `Driver application ${status}.`);
    await refreshDashboard();
  } catch (error) {
    say("admin-message", explain(error), true);
    approve.disabled = false;
    reject.disabled = false;
  }
}
