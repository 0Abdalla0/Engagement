/* -----------------------------------------------------
   Viewer.js — Full Stable Version (Cloudinary delete via Node.js backend)
   Safe Firebase reads, infinite scroll, modal deletion, mobile gestures
----------------------------------------------------- */

const grid = document.getElementById("grid");

// Firebase reference
const db = firebase.database();
const messagesRef = db.ref("messages");

// Infinite scroll variables
const PAGE_SIZE = 8;
let lastKey = null;
let loading = false;
let finished = false;

// Mobile double-tap detection
let lastTapTime = 0;

/* -----------------------------------------------------
   Load first set of messages
----------------------------------------------------- */
loadMore();

/* -----------------------------------------------------
   Infinite scroll
----------------------------------------------------- */
window.addEventListener("scroll", () => {
  if (loading || finished) return;

  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) {
    loadMore();
  }
});

/* -----------------------------------------------------
   Load more messages from Firebase
----------------------------------------------------- */
function loadMore() {
  if (loading) return;
  loading = true;

  let query = messagesRef.orderByChild("time").limitToLast(PAGE_SIZE + 1);
  if (lastKey) query = query.endAt(lastKey);

  query.once("value", (snap) => {
    const raw = snap.val();

    // If empty database
    if (!raw || typeof raw !== "object") {
      document.getElementById("loader").textContent = "No messages yet ❤️";
      finished = true;
      loading = false;
      return;
    }

    // FILTER out invalid entries
    const valid = Object.entries(raw).filter(([id, msg]) => {
      return (
        msg &&
        typeof msg === "object" &&
        typeof msg.time === "number" &&
        !isNaN(msg.time)
      );
    });

    // No valid messages
    if (valid.length === 0) {
      document.getElementById("loader").textContent = "No valid messages ❤️";
      finished = true;
      loading = false;
      return;
    }

    // Sort newest → oldest
    const items = valid.sort((a, b) => b[1].time - a[1].time);

    if (lastKey) items.shift();
    if (items.length < PAGE_SIZE) finished = true;

    items.forEach(([id, item]) => renderCard(id, item));

    lastKey = items[items.length - 1][1].time;
    loading = false;
  });
}

/* -----------------------------------------------------
   Render card
----------------------------------------------------- */
function renderCard(id, item) {
  const card = document.createElement("div");
  card.className = "card";

  // Mobile double-tap
  card.addEventListener("click", () => {
    const now = Date.now();
    if (now - lastTapTime < 300) {
      openDeletePopup(id, item);
    }
    lastTapTime = now;
  });

  // Desktop double-click
  card.addEventListener("dblclick", () => openDeletePopup(id, item));

  // Drawing section
  const imgwrap = document.createElement("div");
  imgwrap.className = "imgwrap";

  if (item.drawing) {
    const img = document.createElement("img");
    img.src = item.drawing;
    img.alt = "Drawing";
    imgwrap.appendChild(img);
  } else {
    const empty = document.createElement("span");
    empty.textContent = "No Drawing";
    imgwrap.appendChild(empty);
  }

  // Message text
  const msg = document.createElement("p");
  msg.className = "msg";
  msg.textContent = item.message || "No message";
  msg.style.color = item.color || "#000";

  card.appendChild(imgwrap);
  card.appendChild(msg);
  grid.appendChild(card);
}

/* -----------------------------------------------------
   Delete Popup
----------------------------------------------------- */
function openDeletePopup(id, item) {
  if (!id || !item) return;

  const popup = document.getElementById("deletePopup");
  const overlay = document.getElementById("popupOverlay");

  popup.style.display = "block";
  overlay.style.display = "block";

  // Reset password field
  document.getElementById("deletePassword").value = "";

  // Confirm delete
  document.getElementById("confirmDelete").onclick = () => {
    const pass = document.getElementById("deletePassword").value.trim();

    if (pass !== "a&s#delete") {
      showResultPopup("Wrong password ❌");
      closePopup();
      return;
    }

    deleteMessage(id, item);
  };

  // Cancel button
  document.getElementById("cancelDelete").onclick = closePopup;
}

function closePopup() {
  document.getElementById("deletePopup").style.display = "none";
  document.getElementById("popupOverlay").style.display = "none";
}

/* -----------------------------------------------------
   Delete Message (Firebase + Cloudinary)
----------------------------------------------------- */
async function deleteMessage(id, item) {
  try {
    // Delete from Firebase
    await messagesRef.child(id).remove();

    // Delete Cloudinary file if exists
    if (item.drawing) {
      const publicId = extractPublicId(item.drawing);
      if (publicId) {
        await deleteCloudinary(publicId);
      }
    }

    showResultPopup("Deleted Successfully ✅");

    // Remove UI card smoothly
    const cards = document.querySelectorAll(".card");
    cards.forEach((c) => {
      if (c.innerText.includes(item.message)) {
        c.style.opacity = "0";
        setTimeout(() => c.remove(), 400);
      }
    });
  } catch (err) {
    console.error(err);
    showResultPopup("Delete Failed ❌");
  }

  closePopup();
}

/* -----------------------------------------------------
   Extract Cloudinary Public ID
----------------------------------------------------- */
function extractPublicId(url) {
  try {
    const parts = url.split("/");
    const file = parts[parts.length - 1];
    return file.split(".")[0];
  } catch {
    return null;
  }
}

/* -----------------------------------------------------
   Call your Node.js backend to delete Cloudinary image
----------------------------------------------------- */
async function deleteCloudinary(publicId) {
  try {
    const response = await fetch(
      `http://localhost:3000/cloudinary-delete,?public_id=${publicId}`,
      { method: "DELETE" }
    );

    if (!response.ok) {
      throw new Error("Cloudinary delete failed");
    }

    return true;
  } catch (err) {
    console.error("Cloudinary delete error:", err);
    return false;
  }
}

/* -----------------------------------------------------
   Result popup (success or error)
----------------------------------------------------- */
function showResultPopup(text) {
  const popup = document.getElementById("resultPopup");
  const overlay = document.getElementById("popupOverlay");

  popup.querySelector("p").textContent = text;

  popup.style.display = "block";
  overlay.style.display = "block";

  setTimeout(() => {
    popup.style.display = "none";
    overlay.style.display = "none";
  }, 1800);
}
