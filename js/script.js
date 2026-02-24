document.addEventListener("DOMContentLoaded", function () {
  // ===============================
  // Prevent scrolling while drawing
  // ===============================
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
  // COUNTDOWN TIMER
  // ===============================
  const countDownDate = new Date("Mar 21, 2026 20:00:00").getTime();
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

  document.getElementById("guestMessage").oninput = (e) => {
    const text = e.target.value.trim();
    previewText.textContent = text || "Your message will appear here...";
  };

  // ===============================
  // CANVAS + DRAWING + UNDO / REDO
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

  canvas.addEventListener("mousedown", startDraw);
  canvas.addEventListener("mousemove", draw);
  canvas.addEventListener("mouseup", stopDraw);
  canvas.addEventListener("mouseleave", stopDraw);

  // ===============================
  // TOUCH EVENTS (FIXED UNDO)
  // ===============================
  canvas.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();

      if (!drawing) {
        undoStack.push(canvas.toDataURL());
        redoStack = [];
      }

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

  document.getElementById("clearCanvas").onclick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  window.undo = function () {
    if (!undoStack.length) return;

    redoStack.push(canvas.toDataURL());
    const img = new Image();
    img.src = undoStack.pop();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
  };

  window.redo = function () {
    if (!redoStack.length) return;

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
  // FIREBASE SAVE (LOCKED)
  // ===============================
  const dbRef = firebase.database().ref("messages");
  let isSaving = false;

  function getCanvasBlob() {
    return new Promise((res) =>
      canvas.toBlob((blob) => res(blob), "image/png")
    );
  }

  document.getElementById("saveMessage").onclick = async () => {
    if (isSaving) return;
    isSaving = true;

    const saveBtn = document.getElementById("saveMessage");
    saveBtn.disabled = true;
    saveBtn.style.opacity = "0.6";

    const msg = document.getElementById("guestMessage").value.trim();
    const blob = await getCanvasBlob();

    const isCanvasEmpty = blob.size < 2000;
    if (!msg && isCanvasEmpty) {
      alert("Please write a message or draw something!");
      saveBtn.disabled = false;
      saveBtn.style.opacity = "1";
      isSaving = false;
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

        setTimeout(() => {
          document.getElementById("saveStatus").textContent = "";
          saveBtn.disabled = false;
          saveBtn.style.opacity = "1";
          isSaving = false;
        }, 3000);

        document.getElementById("guestMessage").value = "";
        previewText.textContent = "Your message will appear here...";
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      })
      .catch((err) => {
        console.error(err);
        document.getElementById("saveStatus").textContent =
          "Error saving. Please try again.";

        saveBtn.disabled = false;
        saveBtn.style.opacity = "1";
        isSaving = false;
      });
  };
});

// ===============================
// TRANSLATIONS
// ===============================
const translations = {
  en: {
    names: "Abdelrhman & Salma",
    engaged: "We're Getting Engaged!",
    saveDate: "Save The Date",
    day: "Sunday",
    time: "at 8:00 PM",
    days: "Days",
    hours: "Hours",
    minutes: "Minutes",
    seconds: "Seconds",
    leaveMsg: "Leave Us a Message 💌",
    pickColor: "Pick a Color:",
    messagePlaceholder: "Your Message...",
    previewPlaceholder: "Your message will appear here...",
    drawTitle: "Or Draw Something 🎨",
    undo: "Undo ↩️",
    redo: "Redo ↪️",
    clear: "Clear",
    saveMessage: "Save Message ❤️",
    viewMessages: "View Messages",
    location: "Location",
    locationSoon: "Will be updated soon ❤️",
    uploadPhotos: "Upload Photos Here",
    qrText: "You can click or scan this QR code 📸",
    footer: "We can't wait to see you!",
  },
  ar: {
    names: "عبدالرحمن وسلمى",
    engaged: "نحتفل بخطوبتنا",
    saveDate: "احفظوا الموعد",
    day: "الأحد",
    time: "الساعة 8:00 مساءً",
    days: "يوم",
    hours: "ساعات",
    minutes: "دقائق",
    seconds: "ثواني",
    leaveMsg: "اتركوا لنا رسالة 💌",
    pickColor: "اختر لونًا:",
    messagePlaceholder: "اكتب رسالتك...",
    previewPlaceholder: "ستظهر رسالتك هنا...",
    drawTitle: "أو ارسم شيئًا 🎨",
    undo: "تراجع ↩️",
    redo: "إعادة ↪️",
    clear: "مسح",
    saveMessage: "حفظ الرسالة ❤️",
    viewMessages: "عرض الرسائل",
    location: "الموقع",
    locationSoon: "سيتم التحديث قريبًا ❤️",
    uploadPhotos: "ارفع الصور هنا",
    qrText: "يمكنك الضغط أو مسح رمز QR 📸",
    footer: "ننتظركم بكل شوق!",
  },
};

function toggleLanguage() {
  const body = document.body;
  const btn = document.querySelector(".lang-btn");

  const isArabic = body.classList.toggle("ar");
  const lang = isArabic ? "ar" : "en";

  btn.textContent = isArabic ? "English" : "العربية";

  document.querySelectorAll("[data-key]").forEach((el) => {
    const key = el.getAttribute("data-key");
    if (translations[lang][key]) {
      if (el.placeholder !== undefined) {
        el.placeholder = translations[lang][key];
      } else {
        el.textContent = translations[lang][key];
      }
    }
  });
}
