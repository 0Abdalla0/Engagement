document.addEventListener("DOMContentLoaded", function () {
  // Prevent scrolling while drawing
  document.body.addEventListener(
    "touchmove",
    function (e) {
      if (drawing) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  // ===============================
  //   COUNTDOWN TIMER
  // ===============================
  const countDownDate = new Date("Mar 6, 2026 20:00:00").getTime();
  setInterval(() => {
    const now = Date.now();
    const d = countDownDate - now;

    if (d < 0) {
      ["days", "hours", "minutes", "seconds"].forEach(
        (id) => (document.getElementById(id).textContent = "0")
      );
      return;
    }

    document.getElementById("days").textContent = Math.floor(d / 86400000);
    document.getElementById("hours").textContent = Math.floor(
      (d % 86400000) / 3600000
    );
    document.getElementById("minutes").textContent = Math.floor(
      (d % 3600000) / 60000
    );
    document.getElementById("seconds").textContent = Math.floor(
      (d % 60000) / 1000
    );
  }, 1000);

  // ===============================
  // COLOR PICKER + PREVIEW
  // ===============================
  let selectedColor = "#000";

  document.querySelectorAll(".color-dot").forEach((dot) => {
    dot.onclick = () => {
      document.querySelector(".color-dot.active")?.classList.remove("active");
      dot.classList.add("active");
      selectedColor = dot.dataset.color;
      document.getElementById("previewText").style.color = selectedColor;
    };
  });

  const defaultDot = document.querySelector(".color-dot.black");
  if (defaultDot) defaultDot.classList.add("active");

  const previewText = document.getElementById("previewText");
  if (previewText) previewText.style.color = "#000";

  // Live preview
  document.getElementById("guestMessage").oninput = (e) => {
    const text = e.target.value.trim();
    previewText.textContent = text || "Your message will appear here...";
  };

  // ===============================
  // CANVAS + DRAWING + UNDO/REDO
  // ===============================
  const canvas = document.getElementById("drawCanvas");
  const ctx = canvas.getContext("2d");

  let undoStack = [];
  let redoStack = [];
  let drawing = false;

  function resizeCanvas() {
    canvas.width = canvas.offsetWidth;
    canvas.height = 260;

    ctx.lineWidth = 3;
    ctx.strokeStyle = selectedColor;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    if (e.touches)
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    return { x: e.offsetX, y: e.offsetY };
  }

  canvas.addEventListener("mousedown", startDraw);
  canvas.addEventListener("mousemove", draw);
  canvas.addEventListener("mouseup", stopDraw);
  canvas.addEventListener("mouseleave", stopDraw);

  function startDraw(e) {
    e.preventDefault();
    drawing = true;
    ctx.beginPath();
    const { x, y } = getPos(e);
    ctx.moveTo(x, y);
    ctx.hasSavedState = false;
  }

  function stopDraw() {
    drawing = false;
    ctx.closePath();
    ctx.hasSavedState = false;
  }

  function draw(e) {
    e.preventDefault();
    if (!drawing) return;

    if (!ctx.hasSavedState) {
      undoStack.push(canvas.toDataURL());
      redoStack = [];
      ctx.hasSavedState = true;
    }

    ctx.lineWidth = 3;
    ctx.strokeStyle = selectedColor;

    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  // Touch events
  canvas.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      drawing = true;
      ctx.beginPath();
      const { x, y } = getPos(e);
      ctx.moveTo(x, y);
    },
    { passive: false }
  );

  canvas.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      if (!drawing) return;

      ctx.lineWidth = 3;
      ctx.strokeStyle = selectedColor;

      const { x, y } = getPos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    },
    { passive: false }
  );

  canvas.addEventListener(
    "touchend",
    (e) => {
      e.preventDefault();
      drawing = false;
      ctx.closePath();
    },
    { passive: false }
  );

  // Clear
  document.getElementById("clearCanvas").onclick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // Undo
  window.undo = function () {
    if (undoStack.length === 0) return;

    redoStack.push(canvas.toDataURL());

    const img = new Image();
    img.src = undoStack.pop();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
  };

  // Redo
  window.redo = function () {
    if (redoStack.length === 0) return;

    undoStack.push(canvas.toDataURL());

    const img = new Image();
    img.src = redoStack.pop();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
  };

  // ===============================
  // CLOUDINARY UPLOAD
  // ===============================
  async function uploadToCloudinary(blob) {
    const cloudName = "dpny4eovt";
    const uploadPreset = "unsigned";

    const formData = new FormData();
    formData.append("file", blob);
    formData.append("upload_preset", uploadPreset);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: "POST", body: formData }
    );

    const data = await res.json();
    return data.secure_url;
  }

  // ===============================
  // FIREBASE SAVE
  // ===============================
  const dbRef = firebase.database().ref("messages");

  function getCanvasBlob() {
    return new Promise((res) =>
      canvas.toBlob((blob) => res(blob), "image/png")
    );
  }

  document.getElementById("saveMessage").onclick = async () => {
    const msg = document.getElementById("guestMessage").value.trim();
    const blob = await getCanvasBlob();

    const isCanvasEmpty = blob.size < 2000;
    if (!msg && isCanvasEmpty) {
      alert("Please write a message or draw something!");
      return;
    }

    let drawingURL = null;
    if (!isCanvasEmpty) {
      drawingURL = await uploadToCloudinary(blob);
    }

    dbRef
      .push({
        message: msg,
        color: selectedColor,
        drawing: drawingURL,
        time: Date.now(),
      })
      .then(() => {
        document.getElementById("saveStatus").textContent =
          "Saved Successfully 💖";
        setTimeout(
          () => (document.getElementById("saveStatus").textContent = ""),
          3000
        );

        document.getElementById("guestMessage").value = "";
        previewText.textContent = "Your message will appear here...";
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      })
      .catch((err) => {
        console.error(err);
        document.getElementById("saveStatus").textContent =
          "Error saving. Please try again.";
      });
  };
});
