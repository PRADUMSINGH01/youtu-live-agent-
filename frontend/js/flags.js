// 198+ Sovereign Countries with ISO Codes and Instant Preloader
export const COUNTRIES = [
  ["Afghanistan", "af"], ["Albania", "al"], ["Algeria", "dz"], ["Andorra", "ad"], ["Angola", "ao"],
  ["Antigua & Barbuda", "ag"], ["Argentina", "ar"], ["Armenia", "am"], ["Australia", "au"], ["Austria", "at"],
  ["Azerbaijan", "az"], ["Bahamas", "bs"], ["Bahrain", "bh"], ["Bangladesh", "bd"], ["Barbados", "bb"],
  ["Belarus", "by"], ["Belgium", "be"], ["Belize", "bz"], ["Benin", "bj"], ["Bhutan", "bt"],
  ["Bolivia", "bo"], ["Bosnia & Herzegovina", "ba"], ["Botswana", "bw"], ["Brazil", "br"], ["Brunei", "bn"],
  ["Bulgaria", "bg"], ["Burkina Faso", "bf"], ["Burundi", "bi"], ["Cambodia", "kh"], ["Cameroon", "cm"],
  ["Canada", "ca"], ["Cape Verde", "cv"], ["Central African Rep", "cf"], ["Chad", "td"], ["Chile", "cl"],
  ["China", "cn"], ["Colombia", "co"], ["Comoros", "km"], ["Congo", "cg"], ["Costa Rica", "cr"],
  ["Croatia", "hr"], ["Cuba", "cu"], ["Cyprus", "cy"], ["Czechia", "cz"], ["Denmark", "dk"],
  ["Djibouti", "dj"], ["Dominica", "dm"], ["Dominican Rep", "do"], ["Ecuador", "ec"], ["Egypt", "eg"],
  ["El Salvador", "sv"], ["Equatorial Guinea", "gq"], ["Eritrea", "er"], ["Estonia", "ee"], ["Eswatini", "sz"],
  ["Ethiopia", "et"], ["Fiji", "fj"], ["Finland", "fi"], ["France", "fr"], ["Gabon", "ga"],
  ["Gambia", "gm"], ["Georgia", "ge"], ["Germany", "de"], ["Ghana", "gh"], ["Greece", "gr"],
  ["Grenada", "gd"], ["Guatemala", "gt"], ["Guinea", "gn"], ["Guinea-Bissau", "gw"], ["Guyana", "gy"],
  ["Haiti", "ht"], ["Honduras", "hn"], ["Hungary", "hu"], ["Iceland", "is"], ["India", "in"],
  ["Indonesia", "id"], ["Iran", "ir"], ["Iraq", "iq"], ["Ireland", "ie"], ["Israel", "il"],
  ["Italy", "it"], ["Ivory Coast", "ci"], ["Jamaica", "jm"], ["Japan", "jp"], ["Jordan", "jo"],
  ["Kazakhstan", "kz"], ["Kenya", "ke"], ["Kiribati", "ki"], ["Kosovo", "xk"], ["Kuwait", "kw"],
  ["Kyrgyzstan", "kg"], ["Laos", "la"], ["Latvia", "lv"], ["Lebanon", "lb"], ["Lesotho", "ls"],
  ["Liberia", "lr"], ["Libya", "ly"], ["Liechtenstein", "li"], ["Lithuania", "lt"], ["Luxembourg", "lu"],
  ["Madagascar", "mg"], ["Malawi", "mw"], ["Malaysia", "my"], ["Maldives", "mv"], ["Mali", "ml"],
  ["Malta", "mt"], ["Marshall Islands", "mh"], ["Mauritania", "mr"], ["Mauritius", "mu"], ["Mexico", "mx"],
  ["Micronesia", "fm"], ["Moldova", "md"], ["Monaco", "mc"], ["Mongolia", "mn"], ["Montenegro", "me"],
  ["Morocco", "ma"], ["Mozambique", "mz"], ["Myanmar", "mm"], ["Namibia", "na"], ["Nauru", "nr"],
  ["Nepal", "np"], ["Netherlands", "nl"], ["New Zealand", "nz"], ["Nicaragua", "ni"], ["Niger", "ne"],
  ["Nigeria", "ng"], ["North Macedonia", "mk"], ["Norway", "no"], ["Oman", "om"], ["Pakistan", "pk"],
  ["Palau", "pw"], ["Palestine", "ps"], ["Panama", "pa"], ["Papua New Guinea", "pg"], ["Paraguay", "py"],
  ["Peru", "pe"], ["Philippines", "ph"], ["Poland", "pl"], ["Portugal", "pt"], ["Qatar", "qa"],
  ["Romania", "ro"], ["Russia", "ru"], ["Rwanda", "rw"], ["Saint Kitts & Nevis", "kn"], ["Saint Lucia", "lc"],
  ["Saint Vincent", "vc"], ["Samoa", "ws"], ["San Marino", "sm"], ["Sao Tome & Principe", "st"], ["Saudi Arabia", "sa"],
  ["Senegal", "sn"], ["Serbia", "rs"], ["Seychelles", "sc"], ["Sierra Leone", "sl"], ["Singapore", "sg"],
  ["Slovakia", "sk"], ["Slovenia", "si"], ["Solomon Islands", "sb"], ["Somalia", "so"], ["South Africa", "za"],
  ["South Korea", "kr"], ["South Sudan", "ss"], ["Spain", "es"], ["Sri Lanka", "lk"], ["Sudan", "sd"],
  ["Suriname", "sr"], ["Sweden", "se"], ["Switzerland", "ch"], ["Syria", "sy"], ["Taiwan", "tw"],
  ["Tajikistan", "tj"], ["Tanzania", "tz"], ["Thailand", "th"], ["Timor-Leste", "tl"], ["Togo", "tg"],
  ["Tonga", "to"], ["Trinidad & Tobago", "tt"], ["Tunisia", "tn"], ["Turkey", "tr"], ["Turkmenistan", "tm"],
  ["Tuvalu", "tv"], ["Uganda", "ug"], ["Ukraine", "ua"], ["UAE", "ae"], ["United Kingdom", "gb"],
  ["USA", "us"], ["Uruguay", "uy"], ["Uzbekistan", "uz"], ["Vanuatu", "vu"], ["Vatican City", "va"],
  ["Venezuela", "ve"], ["Vietnam", "vn"], ["Yemen", "ye"], ["Zambia", "zm"], ["Zimbabwe", "zw"],
  ["Scotland", "gb-sct"], ["Wales", "gb-wls"], ["Northern Ireland", "gb-nir"]
];

export const getFlagUrl = (code) => `https://flagcdn.com/w160/${code.toLowerCase()}.png`;

// Fast procedural fallback generator
function generateProceduralFlag(name, code, size = 96) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const radius = size / 2 - 3;

  // Generate deterministic pleasant background color based on country code
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = code.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
  ctx.clip();

  // Vibrant gradient background
  const bgGrad = ctx.createLinearGradient(0, 0, size, size);
  bgGrad.addColorStop(0, `hsl(${h}, 70%, 45%)`);
  bgGrad.addColorStop(1, `hsl(${(h + 40) % 360}, 80%, 25%)`);
  ctx.fillStyle = bgGrad;
  ctx.fill();

  // Country code initials
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 24px Outfit, Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(code.toUpperCase().slice(0, 3), size / 2, size / 2);

  // Gloss overlay
  const gloss = ctx.createLinearGradient(0, 0, size, size);
  gloss.addColorStop(0, "rgba(255, 255, 255, 0.4)");
  gloss.addColorStop(0.4, "rgba(255, 255, 255, 0.05)");
  gloss.addColorStop(1, "rgba(0, 0, 0, 0.35)");
  ctx.fillStyle = gloss;
  ctx.fill();

  // White stroke border
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.restore();

  return canvas;
}

// Pre-render flag orb from loaded Image
function renderCircularFlag(img, size = 96) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const radius = size / 2 - 3;

  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  const aspect = img.width / img.height;
  let drawW = size;
  let drawH = size;
  if (aspect > 1) {
    drawW = size * aspect;
  } else {
    drawH = size / aspect;
  }
  ctx.drawImage(img, (size - drawW) / 2, (size - drawH) / 2, drawW, drawH);
  ctx.restore();

  // Metallic 3D sphere glossy highlight
  ctx.save();
  const gloss = ctx.createLinearGradient(0, 0, size, size);
  gloss.addColorStop(0, "rgba(255, 255, 255, 0.45)");
  gloss.addColorStop(0.35, "rgba(255, 255, 255, 0.1)");
  gloss.addColorStop(0.7, "rgba(0, 0, 0, 0)");
  gloss.addColorStop(1, "rgba(0, 0, 0, 0.45)");
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
  ctx.fillStyle = gloss;
  ctx.fill();

  // Crisp border
  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.restore();

  return canvas;
}

// Ultra-fast parallel preloader with 1.2s timeout fallback
export async function preloadFlags(onProgress) {
  const circularCanvasMap = new Map();
  let loadedCount = 0;
  const total = COUNTRIES.length;

  // Initialize immediate fallback canvases first so game can start with zero wait
  COUNTRIES.forEach(([name, code]) => {
    circularCanvasMap.set(code, generateProceduralFlag(name, code));
  });

  // Load official flag images concurrently in background with fast timeout
  const promises = COUNTRIES.map(([name, code]) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      let completed = false;
      const timeout = setTimeout(() => {
        if (!completed) {
          completed = true;
          loadedCount++;
          if (onProgress) onProgress(loadedCount, total);
          resolve();
        }
      }, 1400);

      img.onload = () => {
        if (!completed) {
          completed = true;
          clearTimeout(timeout);
          circularCanvasMap.set(code, renderCircularFlag(img));
          loadedCount++;
          if (onProgress) onProgress(loadedCount, total);
          resolve();
        }
      };

      img.onerror = () => {
        if (!completed) {
          completed = true;
          clearTimeout(timeout);
          loadedCount++;
          if (onProgress) onProgress(loadedCount, total);
          resolve();
        }
      };

      img.src = getFlagUrl(code);
    });
  });

  // Wait max 1.5s total or until majority loaded
  await Promise.race([
    Promise.all(promises),
    new Promise((res) => setTimeout(res, 1600)),
  ]);

  return { circularCanvasMap };
}
