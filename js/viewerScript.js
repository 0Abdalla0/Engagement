/* -----------------------------------------------------
   Viewer.js — Clean Delete Version
   Deletes from Firebase ONLY and removes the card visually
----------------------------------------------------- */

const grid = document.getElementById("grid");

// Firebase reference
const db = firebase.database();
const messagesRef = db.ref("messages");

// Infinite scroll settings
const PAGE_SIZE = 8;
let lastKey = null;
let loading = false;
let finished = false;

// Double-tap detection (mobile)
let lastTapTime = 0;

/* ------------------------- Load first messages ------------------------- */
loadMore();

/* ------------------------- Infinite scroll ------------------------- */
window.addEventListener("scroll", () => {
  if (loading || finished) return;

  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) {
    loadMore();
  }
});

/* ------------------------- Load messages ------------------------- */
function loadMore() {
  if (loading) return;
  loading = true;

  let query = messagesRef.orderByChild("time").limitToLast(PAGE_SIZE + 1);
  if (lastKey) query = query.endAt(lastKey);

  query.once("value", (snap) => {
    const raw = snap.val();

    if (!raw || typeof raw !== "object") {
      document.getElementById("loader").textContent = "No messages yet ❤️";
      finished = true;
      loading = false;
      return;
    }

    const valid = Object.entries(raw).filter(([id, msg]) => {
      return msg && typeof msg === "object" && typeof msg.time === "number";
    });

    if (valid.length === 0) {
      finished = true;
      loading = false;
      return;
    }

    const items = valid.sort((a, b) => b[1].time - a[1].time);

    if (lastKey) items.shift();
    if (items.length < PAGE_SIZE) finished = true;

    items.forEach(([id, item]) => renderCard(id, item));

    lastKey = items[items.length - 1][1].time;
    loading = false;
  });
}

/* ------------------------- Render Card ------------------------- */
function renderCard(id, item) {
  const card = document.createElement("div");
  card.className = "card";

  // Double-tap mobile
  card.addEventListener("click", () => {
    const now = Date.now();
    if (now - lastTapTime < 300) openDeletePopup(id, item, card);
    lastTapTime = now;
  });

  // Double-click desktop
  card.addEventListener("dblclick", () => openDeletePopup(id, item, card));

  const imgwrap = document.createElement("div");
  imgwrap.className = "imgwrap";

  if (item.drawing) {
    const img = document.createElement("img");
    img.src = item.drawing;
    imgwrap.appendChild(img);
  } else {
    const empty = document.createElement("span");
    empty.textContent = "No Drawing";
    imgwrap.appendChild(empty);
  }

  const msg = document.createElement("p");
  msg.className = "msg";
  msg.textContent = item.message || "No message";
  msg.style.color = item.color || "#000";

  card.appendChild(imgwrap);
  card.appendChild(msg);
  grid.appendChild(card);
}

/* ------------------------- Delete Popup ------------------------- */
function openDeletePopup(id, item, cardElement) {
  const popup = document.getElementById("deletePopup");
  const overlay = document.getElementById("popupOverlay");

  popup.style.display = "block";
  overlay.style.display = "block";

  document.getElementById("deletePassword").value = "";

  document.getElementById("confirmDelete").onclick = () => {
    const pass = document.getElementById("deletePassword").value.trim();

    if (pass !== "a&s#delete") {
      showResultPopup("Wrong password ❌");
      closePopup();
      return;
    }

    deleteMessage(id, cardElement);
  };

  document.getElementById("cancelDelete").onclick = closePopup;
}

function closePopup() {
  document.getElementById("deletePopup").style.display = "none";
  document.getElementById("popupOverlay").style.display = "none";
}

/* ------------------------- Delete Firebase + UI Card ------------------------- */
async function deleteMessage(id, cardElement) {
  try {
    await messagesRef.child(id).remove();

    // fade out and remove the card only
    cardElement.style.opacity = "0";
    setTimeout(() => cardElement.remove(), 400);

    showResultPopup("Deleted Successfully ✅");
  } catch (err) {
    console.error(err);
    showResultPopup("Delete Failed ❌");
  }

  closePopup();
}

/* ------------------------- Result popup ------------------------- */
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
/* ------------------------- Back Button ------------------------- */
document.getElementById("backBtn").onclick = () => {
  window.location.href = "index.html"; // or whichever page you want
};
