/*
 * GeoMatch — Geothermal Career Explorer
 * One file: questions, scoring, results, email, analytics, admin view.
 * No frameworks, no build step, no fetch() of local data (file:// safe).
 */
(function () {
  "use strict";

  /* ============================== Config ============================== */

  var CONFIG = {
    idleSeconds: 180,
    analyticsEndpoint: "",
    emailEndpoint: "",
    adminPin: "1234",
    privacyContact: "amarise@geothermal.org"
  };

  /* ============================== Helpers ============================== */

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }
  function $(id) { return document.getElementById(id); }
  function uid() {
    return "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function uniq(arr) {
    var seen = {}, out = [];
    arr.forEach(function (x) { if (!seen[x]) { seen[x] = true; out.push(x); } });
    return out;
  }
  function overlap(a, b) {
    a = a || []; b = b || [];
    return a.filter(function (x) { return b.indexOf(x) > -1; });
  }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function safeLocalStorageGet(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function safeLocalStorageSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }

  /* ============================== Question data ============================== */

  var STAGE_OPTIONS = [
    { label: "Middle School", hint: "Ages ~11–14", group: "school" },
    { label: "High School", hint: "Choosing subjects and next steps", group: "school" },
    { label: "College / Technical Program", hint: "Diploma, associate degree or trade program", group: "tertiary" },
    { label: "Undergraduate", hint: "Bachelor's degree", group: "tertiary" },
    { label: "Graduate Student", hint: "Master's or PhD", group: "tertiary" },
    { label: "Early Career Professional", hint: "Up to ~5 years working", group: "professional" },
    { label: "Experienced Professional", hint: "5+ years in industry", group: "professional" },
    { label: "Career Changer", hint: "Moving into energy from another field", group: "professional" }
  ];

  var REGION_OPTIONS = [
    "North America", "Latin America & Caribbean", "Europe", "Africa", "Middle East", "Asia-Pacific"
  ];

  var SUBJECT_FIELD_MAP = {
    "Earth & Environmental Science": ["Geology", "Earth Science", "Environmental Science", "Geophysics"],
    "Geography": ["Geography", "Environmental Science"],
    "Physics": ["Physics", "Geophysics", "Electrical Engineering", "Mechanical Engineering"],
    "Chemistry": ["Chemistry", "Chemical Engineering"],
    "Biology": ["Biology", "Environmental Science"],
    "Mathematics": ["Mathematics", "Data Science", "Finance"],
    "Computer Science": ["Computer Science", "Data Science"],
    "Technical Drawing & Engineering": ["Mechanical Engineering", "Civil Engineering", "Electrical Engineering", "Technical / Trades Program"],
    "Business & Economics": ["Business", "Economics", "Finance"],
    "Government & Social Studies": ["Public Policy", "Law", "Geography"],
    "English, Media & Languages": ["Communications", "Marketing", "Education"]
  };
  var SUBJECT_OPTIONS = Object.keys(SUBJECT_FIELD_MAP);

  var FIELD_OPTIONS = [
    "Geology", "Geophysics", "Earth Science", "Geography", "Environmental Science", "Biology", "Chemistry",
    "Physics", "Mathematics", "Computer Science", "Data Science", "Mechanical Engineering", "Electrical Engineering",
    "Civil Engineering", "Chemical Engineering", "Petroleum Engineering", "Business", "Finance", "Economics",
    "Marketing", "Communications", "Public Policy", "Law", "Education", "Technical / Trades Program", "Still deciding"
  ];

  var INDUSTRY_OPTIONS = [
    "Oil & Gas", "Mining", "Utilities", "Power Generation", "Construction", "Manufacturing", "Government",
    "Environmental Consulting", "Academia", "IT / Data", "Finance", "Communications / Media", "Education", "Other"
  ];

  var SCENARIO_OPTIONS = [
    { label: "Find out whether there's enough heat underground to justify a project", clusters: ["Exploration & Earth Sciences", "Reservoir Engineering"] },
    { label: "Plan and drill wells that reach hot rock kilometres below the surface", clusters: ["Drilling & Well Construction"] },
    { label: "Design the plant that turns hot fluid into electricity", clusters: ["Mechanical Engineering", "Electrical Engineering", "Chemical & Process Engineering"] },
    { label: "Run and maintain the plant once it's generating power", clusters: ["Plant Operations & Maintenance", "Skilled Trades"] },
    { label: "Build the roads, well pads and pipelines on site", clusters: ["Civil Engineering", "Skilled Trades"] },
    { label: "Use the heat directly for buildings, greenhouses or industry", clusters: ["Heat Pumps & Direct Use"] },
    { label: "Protect the local environment and assess project impacts", clusters: ["Environmental & Sustainability"] },
    { label: "Secure the funding, contracts and supportive policies", clusters: ["Business & Commercial", "Policy & Law", "Leadership & Management"] },
    { label: "Build the data systems and models that monitor everything", clusters: ["Data & Digital Technology"] },
    { label: "Research new technology so geothermal can work almost anywhere", clusters: ["Research & Academia"] },
    { label: "Explain the project to communities, schools and decision-makers", clusters: ["Communications, Outreach & Education"] }
  ];

  var INTEREST_OPTIONS = [
    "Earth Science", "Engineering", "Energy Systems", "Data & AI", "Sustainability", "Business", "Entrepreneurship",
    "Policy", "Communications", "Education", "Community Engagement", "Research", "Skilled Trades"
  ];

  var ACTIVITY_OPTIONS = [
    "Problem solving", "Working outdoors", "Designing systems", "Building & installing", "Operating equipment",
    "Coding", "Data analysis", "Managing projects", "Working with people", "Teaching", "Public speaking",
    "Writing", "Negotiating", "Research", "Environmental protection", "Leading teams"
  ];

  var ENVIRONMENT_OPTIONS = [
    "Field sites", "Power plant", "Lab", "Construction site", "Office", "Remote / hybrid", "University",
    "Government", "Community settings"
  ];

  var FAMILIARITY_OPTIONS = [
    "Not at all", "I'd heard of it", "I knew the basics", "I've studied or worked in it"
  ];

  var SECTOR_CONTEXT = {
    1: "Geothermal energy uses heat from inside the Earth to generate electricity and to heat and cool buildings. Delivering it takes scientists, engineers, tradespeople, analysts, lawyers and communicators.",
    2: "Geothermal projects operate across the Americas, Africa, Asia-Pacific and Europe. Next-generation approaches such as enhanced geothermal systems (EGS) and closed-loop designs aim to extend it far beyond traditional volcanic regions.",
    3: "Many skills transfer directly. Geothermal drilling and reservoir engineering draw heavily on oil & gas techniques, and plant operations draw on the wider power sector.",
    4: "A geothermal project moves through stages: exploration, drilling, plant design and construction, then decades of operation. Each stage needs different people.",
    5: "Geothermal power is firm, or 'baseload': it generates around the clock regardless of weather, which makes it a strong partner to solar and wind.",
    6: "Not all geothermal is electricity. Direct use applies the heat itself to greenhouses, food drying, aquaculture and district heating, and ground-source heat pumps can heat and cool buildings almost anywhere.",
    7: "Many geothermal careers mix settings. A geologist might spend weeks mapping in the field and months modelling in an office.",
    8: "This question isn't scored. It helps Geothermal Rising understand how much people learn from GeoMatch."
  };

  var CLUSTERS = [
    { name: "Exploration & Earth Sciences", description: "Finding and characterising geothermal resources: geology, geophysics, geochemistry and mapping." },
    { name: "Drilling & Well Construction", description: "Designing and drilling the deep, high-temperature wells every project depends on." },
    { name: "Reservoir Engineering", description: "Modelling heat and fluid flow underground to size projects and sustain them for decades." },
    { name: "Mechanical Engineering", description: "Turbines, heat exchangers and pumps: the machinery that turns heat into power." },
    { name: "Electrical Engineering", description: "Generators, controls and grid connections that deliver geothermal power." },
    { name: "Civil Engineering", description: "Well pads, pipelines, foundations and the construction of geothermal sites." },
    { name: "Chemical & Process Engineering", description: "Managing geothermal fluids, scaling and corrosion, and recovering minerals from brine." },
    { name: "Plant Operations & Maintenance", description: "Running geothermal plants safely and reliably, around the clock." },
    { name: "Heat Pumps & Direct Use", description: "Using geothermal heat directly for buildings, district heating, agriculture and industry." },
    { name: "Environmental & Sustainability", description: "Protecting ecosystems, water and air, and keeping people safe on site." },
    { name: "Data & Digital Technology", description: "Software, data science, automation and cybersecurity across the industry." },
    { name: "Skilled Trades", description: "Electricians, welders, pipefitters, technicians and operators who build and maintain it all." },
    { name: "Business & Commercial", description: "Developing projects, financing them and building the market for geothermal." },
    { name: "Policy & Law", description: "The laws, permits, incentives and regulation that shape where geothermal grows." },
    { name: "Research & Academia", description: "Advancing the science and technology, and training the next generation." },
    { name: "Communications, Outreach & Education", description: "Building public understanding, community trust and the future workforce." },
    { name: "Leadership & Management", description: "Leading projects, programs, teams and new geothermal companies." }
  ];

  var TRANSITION_MAP = {
    "Oil & Gas": { have: ["Drilling operations", "Well design and integrity", "Reservoir analysis", "Subsurface interpretation", "HSE culture", "Project controls"], upskill: ["Geothermal reservoir behaviour", "High-temperature drilling and materials", "Geothermal power plant cycles"] },
    "Mining": { have: ["Field geology", "Geotechnical engineering", "Drilling programs", "Resource estimation", "Remote-site operations", "Safety leadership"], upskill: ["Hydrothermal systems", "Geothermal resource assessment", "Geothermal permitting"] },
    "Utilities": { have: ["Power operations", "Grid reliability", "Maintenance planning", "Electrical safety", "Control rooms", "Asset management"], upskill: ["Geothermal plant cycles (flash and binary)", "Geothermal interconnection", "Brine handling basics"] },
    "Power Generation": { have: ["Plant operations", "Turbines and rotating equipment", "Outage planning", "Reliability", "Electrical systems", "Process safety"], upskill: ["Binary and flash plant operation", "Geothermal fluid chemistry", "Geothermal HSE (including H2S)"] },
    "Construction": { have: ["Site safety", "Scheduling", "Civil works", "Contractor coordination", "Pipe and structural installation", "Crew leadership"], upskill: ["Geothermal project stages", "Steamfield and pipeline construction", "High-temperature piping standards"] },
    "Manufacturing": { have: ["Reliability and maintenance", "Mechanical systems", "Process improvement", "Quality systems", "Automation", "Operations"], upskill: ["Power plant equipment", "Industrial controls for energy", "Corrosion and materials in geothermal fluids"] },
    "Government": { have: ["Program management", "Regulatory knowledge", "Stakeholder coordination", "Grant administration", "Policy writing"], upskill: ["Geothermal policy and incentives", "Resource rights and permitting frameworks", "Clean energy finance"] },
    "Environmental Consulting": { have: ["Permitting", "Environmental assessment", "Field sampling", "GIS", "Technical writing", "Agency coordination"], upskill: ["Geothermal environmental impacts", "H2S and air monitoring", "Geothermal water management"] },
    "Academia": { have: ["Research design", "Data analysis", "Scientific writing", "Teaching", "Grant development", "Mentoring"], upskill: ["Project economics", "Field demonstration projects", "Technology commercialisation"] },
    "IT / Data": { have: ["Software development", "Data engineering", "Analytics", "Cloud systems", "Cybersecurity", "Automation"], upskill: ["Industrial IoT and SCADA", "OT cybersecurity", "Geothermal domain basics"] },
    "Finance": { have: ["Financial modelling", "Valuation", "Risk analysis", "Investment analysis", "Market analysis"], upskill: ["Geothermal project economics", "Power purchase agreements", "Resource and drilling risk"] },
    "Communications / Media": { have: ["Storytelling", "Content strategy", "Media relations", "Audience research", "Campaign management"], upskill: ["Geothermal science fundamentals", "Community engagement practice", "Energy policy basics"] },
    "Education": { have: ["Curriculum design", "Teaching", "Facilitation", "Program coordination", "Partnership building"], upskill: ["Geothermal science fundamentals", "Workforce development models", "Industry partnerships"] }
  };

  var ENTRY_ROUTE_LABELS = {
    "Degree": "University degree",
    "Diploma": "College diploma",
    "Apprenticeship": "Apprenticeship",
    "Certification": "Industry certification",
    "Experience": "On-the-job experience"
  };

  var WEIGHTS = { field: 6, industry: 6, interest: 4, activity: 3, environment: 2, scenario: 5 };

  /* ============================== Data validation ============================== */

  function validateCareerData() {
    var careers = window.GEOMATCH_CAREERS || [];
    var optionSets = {
      fields: FIELD_OPTIONS.filter(function (f) { return f !== "Still deciding"; }),
      industries_transferable_from: INDUSTRY_OPTIONS.filter(function (i) { return i !== "Other"; }),
      interests: INTEREST_OPTIONS,
      activities: ACTIVITY_OPTIONS,
      environments: ENVIRONMENT_OPTIONS
    };
    var clusterNames = CLUSTERS.map(function (c) { return c.name; });
    var unknownTags = [];
    var usedTags = {};
    Object.keys(optionSets).forEach(function (k) { usedTags[k] = {}; });

    careers.forEach(function (career) {
      if (clusterNames.indexOf(career.category) === -1) {
        unknownTags.push(career.title + ": unknown category \"" + career.category + "\"");
      }
      Object.keys(optionSets).forEach(function (tagType) {
        (career[tagType] || []).forEach(function (tag) {
          if (optionSets[tagType].indexOf(tag) === -1) {
            unknownTags.push(career.title + ": unknown " + tagType + " tag \"" + tag + "\"");
          } else {
            usedTags[tagType][tag] = true;
          }
        });
      });
    });

    var unusedOptions = [];
    Object.keys(optionSets).forEach(function (tagType) {
      optionSets[tagType].forEach(function (opt) {
        if (!usedTags[tagType][opt]) unusedOptions.push(tagType + ": \"" + opt + "\" is never used by any career");
      });
    });

    if (unknownTags.length) {
      console.warn("[GeoMatch data check] Unknown tags found (fix data/careers.js):\n" + unknownTags.join("\n"));
    }
    if (unusedOptions.length) {
      console.warn("[GeoMatch data check] Unused option labels (no career uses them):\n" + unusedOptions.join("\n"));
    }
    if (!unknownTags.length && !unusedOptions.length) {
      console.info("[GeoMatch data check] OK — " + careers.length + " careers, no unknown tags, no unused options.");
    }

    CLUSTERS.forEach(function (cluster) {
      var count = careers.filter(function (c) { return c.category === cluster.name; }).length;
      if (count < 3) console.warn("[GeoMatch data check] Cluster \"" + cluster.name + "\" has only " + count + " careers (need >= 3).");
    });
  }

  /* ============================== Cluster profiles ============================== */

  var clusterProfiles = {}; // clusterProfiles[clusterName][tagType][tagValue] = share

  function buildClusterProfiles() {
    var careers = window.GEOMATCH_CAREERS || [];
    var tagTypes = ["fields", "industries_transferable_from", "interests", "activities", "environments"];
    CLUSTERS.forEach(function (cluster) {
      var careersInCluster = careers.filter(function (c) { return c.category === cluster.name; });
      var profile = {};
      tagTypes.forEach(function (tagType) { profile[tagType] = {}; });
      tagTypes.forEach(function (tagType) {
        var counts = {};
        careersInCluster.forEach(function (career) {
          (career[tagType] || []).forEach(function (tag) {
            counts[tag] = (counts[tag] || 0) + 1;
          });
        });
        Object.keys(counts).forEach(function (tag) {
          profile[tagType][tag] = careersInCluster.length ? counts[tag] / careersInCluster.length : 0;
        });
      });
      clusterProfiles[cluster.name] = profile;
    });
  }

  /* ============================== App state ============================== */

  var state = {
    screen: "landing", // landing | question | results | admin
    step: 1,
    answers: {},
    careerStageGroup: null,
    sessionId: uid(),
    startedAt: null,
    isRestoredView: false,
    email: "",
    followUp: false,
    guardianConsent: false,
    emailSendCount: 0,
    multiSelectWarning: {},
    lastStepReached: 0
  };

  var TOTAL_STEPS = 8;

  function stageGroupFor(stageLabel) {
    var opt = STAGE_OPTIONS.filter(function (o) { return o.label === stageLabel; })[0];
    return opt ? opt.group : null;
  }

  /* ============================== Step definitions ============================== */

  function getStepDefinition(stepNumber) {
    switch (stepNumber) {
      case 1:
        return { id: "careerStage", title: "Where are you right now?", type: "single", options: STAGE_OPTIONS.map(function (o) { return { label: o.label, hint: o.hint }; }) };
      case 2:
        return { id: "region", title: "Where in the world are you?", type: "single", options: REGION_OPTIONS.map(function (l) { return { label: l }; }) };
      case 3:
        return getStep3Definition();
      case 4:
        return { id: "scenario", title: "A new geothermal project is being developed. Which part would you most want to work on?", type: "single", wide: true, options: SCENARIO_OPTIONS.map(function (o) { return { label: o.label }; }) };
      case 5:
        return { id: "interests", title: "What are you interested in?", type: "multi", max: 5, options: INTEREST_OPTIONS.map(function (l) { return { label: l }; }) };
      case 6:
        return { id: "activities", title: "Which kinds of work would you enjoy?", type: "multi", max: 5, options: ACTIVITY_OPTIONS.map(function (l) { return { label: l }; }) };
      case 7:
        return { id: "environments", title: "Where would you like to work?", type: "multi", max: 3, options: ENVIRONMENT_OPTIONS.map(function (l) { return { label: l }; }) };
      case 8:
        return { id: "familiarity", title: "Before today, how familiar were you with geothermal energy?", type: "single", notScored: true, options: FAMILIARITY_OPTIONS.map(function (l) { return { label: l }; }) };
      default:
        return null;
    }
  }

  function getStep3Definition() {
    var group = state.careerStageGroup;
    if (group === "school") {
      return { id: "subjects", title: "Which subjects do you enjoy or do best in?", type: "multi", max: 2, options: SUBJECT_OPTIONS.map(function (l) { return { label: l }; }) };
    }
    if (group === "professional") {
      return {
        id: "industry",
        title: "Which industry or field are you coming from?",
        type: "single",
        options: INDUSTRY_OPTIONS.map(function (l) {
          return { label: l, hint: (l !== "Other" && TRANSITION_MAP[l]) ? "Strong transfer path" : "" };
        })
      };
    }
    // tertiary (default)
    return { id: "field", title: "What is your field of study?", type: "single", options: FIELD_OPTIONS.map(function (l) { return { label: l }; }) };
  }

  /* ============================== Scoring engine ============================== */

  function getUserFields() {
    var group = state.careerStageGroup;
    if (group === "school") {
      var fields = [];
      (state.answers.subjects || []).forEach(function (subject) {
        (SUBJECT_FIELD_MAP[subject] || []).forEach(function (f) { fields.push(f); });
      });
      return uniq(fields);
    }
    if (group === "tertiary") {
      var f = state.answers.field;
      return (f && f !== "Still deciding") ? [f] : [];
    }
    return [];
  }

  function scoreAnswers() {
    var clusterScores = {}, contributions = {};
    CLUSTERS.forEach(function (c) { clusterScores[c.name] = 0; contributions[c.name] = []; });
    var maxPossible = 0;

    function addShare(tagType, tagValue, weight) {
      maxPossible += weight;
      CLUSTERS.forEach(function (cluster) {
        var share = (clusterProfiles[cluster.name][tagType] || {})[tagValue] || 0;
        if (share > 0) {
          var pts = weight * share;
          clusterScores[cluster.name] += pts;
          contributions[cluster.name].push({ label: tagValue, points: pts });
        }
      });
    }

    // Field (best single matching field — no double counting)
    var userFields = getUserFields();
    if (userFields.length) {
      maxPossible += WEIGHTS.field;
      CLUSTERS.forEach(function (cluster) {
        var bestShare = 0, bestField = null;
        userFields.forEach(function (f) {
          var share = (clusterProfiles[cluster.name].fields || {})[f] || 0;
          if (share > bestShare) { bestShare = share; bestField = f; }
        });
        if (bestShare > 0) {
          var pts = WEIGHTS.field * bestShare;
          clusterScores[cluster.name] += pts;
          contributions[cluster.name].push({ label: bestField, points: pts });
        }
      });
    }

    // Industry (professionals only, never "Other")
    if (state.careerStageGroup === "professional" && state.answers.industry && state.answers.industry !== "Other") {
      maxPossible += WEIGHTS.industry;
      var industry = state.answers.industry;
      CLUSTERS.forEach(function (cluster) {
        var share = (clusterProfiles[cluster.name].industries_transferable_from || {})[industry] || 0;
        if (share > 0) {
          var pts = WEIGHTS.industry * share;
          clusterScores[cluster.name] += pts;
          contributions[cluster.name].push({ label: industry, points: pts });
        }
      });
    }

    // Scenario (flat +weight to each listed cluster)
    if (state.answers.scenario) {
      maxPossible += WEIGHTS.scenario;
      var scenarioOpt = SCENARIO_OPTIONS.filter(function (o) { return o.label === state.answers.scenario; })[0];
      if (scenarioOpt) {
        scenarioOpt.clusters.forEach(function (clusterName) {
          clusterScores[clusterName] += WEIGHTS.scenario;
          contributions[clusterName].push({ label: state.answers.scenario, points: WEIGHTS.scenario });
        });
      }
    }

    (state.answers.interests || []).forEach(function (i) { addShare("interests", i, WEIGHTS.interest); });
    (state.answers.activities || []).forEach(function (a) { addShare("activities", a, WEIGHTS.activity); });
    (state.answers.environments || []).forEach(function (e) { addShare("environments", e, WEIGHTS.environment); });

    return { clusterScores: clusterScores, contributions: contributions, maxPossible: maxPossible, userFields: userFields };
  }

  function fitPercent(clusterScore, maxPossible) {
    if (!maxPossible) return 0;
    return clamp(Math.round((clusterScore / maxPossible) * 100), 0, 99);
  }

  function rankCareers(scoring) {
    var careers = window.GEOMATCH_CAREERS || [];
    var clusterScores = scoring.clusterScores;
    var topClusterScore = 0;
    Object.keys(clusterScores).forEach(function (k) { if (clusterScores[k] > topClusterScore) topClusterScore = clusterScores[k]; });

    var industry = (state.careerStageGroup === "professional" && state.answers.industry !== "Other") ? state.answers.industry : null;

    var scored = careers.map(function (career) {
      var clusterPts = clusterScores[career.category] || 0;
      var clusterTerm = topClusterScore > 0 ? (clusterPts / topClusterScore) * 10 : 0;
      var matchedInterests = overlap(state.answers.interests, career.interests);
      var matchedActivities = overlap(state.answers.activities, career.activities);
      var matchedEnvironments = overlap(state.answers.environments, career.environments);
      var matchedField = scoring.userFields.filter(function (f) { return (career.fields || []).indexOf(f) > -1; })[0] || null;
      var industryMatches = !!(industry && (career.industries_transferable_from || []).indexOf(industry) > -1);

      var score = clusterTerm
        + 2.5 * matchedInterests.length
        + 2 * matchedActivities.length
        + 1.2 * matchedEnvironments.length
        + (matchedField ? 3 : 0)
        + (industryMatches ? 4 : 0);

      return {
        career: career,
        score: score,
        matchedInterests: matchedInterests,
        matchedActivities: matchedActivities,
        matchedEnvironments: matchedEnvironments,
        matchedField: matchedField,
        industryMatches: industryMatches
      };
    });

    scored.sort(function (a, b) { return b.score - a.score; });

    var top = [], perCategory = {};
    for (var i = 0; i < scored.length && top.length < 5; i++) {
      var item = scored[i];
      var cat = item.career.category;
      perCategory[cat] = perCategory[cat] || 0;
      if (perCategory[cat] >= 2) continue;
      perCategory[cat]++;
      top.push(item);
    }
    return top;
  }

  /* ============================== Rendering: shared ============================== */

  function renderTopbar() {
    var img = $("logo-img");
    if (img) {
      img.onerror = function () {
        $("logo-home-link").classList.add("logo-fallback");
      };
    }
    $("logo-home-link").onclick = function (e) {
      e.preventDefault();
      goHome();
    };
  }

  function hideAllScreens() {
    ["screen-landing", "screen-question", "screen-results", "screen-admin"].forEach(function (id) {
      $(id).classList.remove("active");
    });
  }

  function showScreen(id) {
    hideAllScreens();
    $(id).classList.add("active");
  }

  function goHome() {
    resetAll();
    location.hash = "";
    renderLanding();
  }

  function resetAll() {
    state.step = 1;
    state.answers = {};
    state.careerStageGroup = null;
    state.sessionId = uid();
    state.startedAt = null;
    state.isRestoredView = false;
    state.email = "";
    state.followUp = false;
    state.guardianConsent = false;
    state.emailSendCount = 0;
    state.lastStepReached = 0;
  }

  /* ============================== Landing ============================== */

  function renderLanding() {
    state.screen = "landing";

    $("screen-landing").innerHTML =
      '<div class="landing-wrap landing-wrap-centered">' +
        '<div class="landing-main">' +
          '<p class="eyebrow">Geothermal Rising &middot; Career Discovery</p>' +
          '<h1 class="landing-headline">The heat beneath our feet becomes the power in our homes.<br><span class="headline-accent">It takes people from every field.</span></h1>' +
          '<p class="landing-sub">Discover where you fit in geothermal energy: careers, study pathways and next steps matched to your interests, skills and experience.</p>' +
          '<button type="button" class="btn btn-primary btn-large" id="start-btn">Start exploring</button>' +
          '<p class="landing-note">About 3 minutes &middot; No sign-up needed &middot; Email is optional</p>' +
        '</div>' +
      '</div>';

    showScreen("screen-landing");
    $("start-btn").addEventListener("click", startFlow);
  }

  function startFlow() {
    resetAll();
    state.startedAt = Date.now();
    logEvent("start", { sessionId: state.sessionId, timestamp: state.startedAt });
    state.step = 1;
    renderQuestion();
  }

  /* ============================== Question flow ============================== */

  function renderQuestion() {
    state.screen = "question";
    var def = getStepDefinition(state.step);
    var answer = state.answers[def.id];

    var optionsHtml = def.options.map(function (opt) {
      return renderOptionButton(def, opt, answer);
    }).join("");

    var groupRole = def.type === "single" ? "radiogroup" : "group";

    $("screen-question").innerHTML =
      '<div class="question-wrap">' +
        '<div class="question-main">' +
          '<div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="' + TOTAL_STEPS + '" aria-valuenow="' + state.step + '" aria-label="Step ' + state.step + ' of ' + TOTAL_STEPS + '">' +
            '<div class="progress-fill" style="width:' + Math.round((state.step / TOTAL_STEPS) * 100) + '%"></div>' +
          '</div>' +
          '<p class="step-label">Step ' + state.step + ' of ' + TOTAL_STEPS + '</p>' +
          '<h2 class="question-title">' + esc(def.title) + '</h2>' +
          (def.type === "multi" ? '<p class="multi-hint">Choose up to ' + def.max + '.</p>' : '') +
          '<div class="option-list ' + (def.wide ? "option-list-wide" : "") + '" role="' + groupRole + '" aria-label="' + esc(def.title) + '">' + optionsHtml + '</div>' +
          '<div class="selection-message" id="selection-message" aria-live="polite"></div>' +
          '<div class="step-nav">' +
            '<button type="button" class="btn btn-secondary" id="back-btn" ' + (state.step === 1 ? "disabled" : "") + '>Back</button>' +
            '<button type="button" class="btn btn-primary" id="next-btn" disabled>' + (state.step === TOTAL_STEPS ? "See my results" : "Next") + '</button>' +
          '</div>' +
        '</div>' +
        '<aside class="question-side">' +
          '<div class="side-card">' +
            '<p class="eyebrow-small">Sector context</p>' +
            '<p class="side-text">' + esc(SECTOR_CONTEXT[state.step]) + '</p>' +
          '</div>' +
          '<div class="side-card" id="summary-card">' + renderSummary() + '</div>' +
        '</aside>' +
      '</div>';

    showScreen("screen-question");
    bindQuestionEvents(def);
    updateNextEnabled(def);
  }

  function renderOptionButton(def, opt, answer) {
    var isMulti = def.type === "multi";
    var selected = isMulti ? (answer || []).indexOf(opt.label) > -1 : answer === opt.label;
    var roleAttr = isMulti ? 'aria-pressed="' + selected + '"' : 'role="radio" aria-checked="' + selected + '"';
    return (
      '<button type="button" class="option-card' + (selected ? " selected" : "") + '" data-value="' + esc(opt.label) + '" ' + roleAttr + '>' +
        '<span class="option-label">' + esc(opt.label) + '</span>' +
        (opt.hint ? '<span class="option-hint">' + esc(opt.hint) + '</span>' : '') +
      '</button>'
    );
  }

  function renderSummary() {
    var lines = [];
    var order = [
      ["careerStage", "Stage"], ["region", "Region"], ["subjects", "Subjects"], ["field", "Field"],
      ["industry", "Industry"], ["scenario", "Scenario"], ["interests", "Interests"],
      ["activities", "Working style"], ["environments", "Environment"], ["familiarity", "Familiarity"]
    ];
    order.forEach(function (pair) {
      var key = pair[0], label = pair[1];
      var val = state.answers[key];
      if (val == null || (Array.isArray(val) && !val.length)) return;
      var display = Array.isArray(val) ? val.join(", ") : val;
      lines.push('<div class="summary-row"><span class="summary-key">' + esc(label) + '</span><span class="summary-val">' + esc(display) + '</span></div>');
    });
    if (!lines.length) return '<p class="eyebrow-small">Your answers</p><p class="side-text muted">Your choices will appear here as you go.</p>';
    return '<p class="eyebrow-small">Your answers so far</p>' + lines.join("");
  }

  function bindQuestionEvents(def) {
    var cards = Array.prototype.slice.call(document.querySelectorAll(".option-card"));
    cards.forEach(function (card) {
      card.addEventListener("click", function () { handleOptionClick(def, card.getAttribute("data-value")); });
    });
    $("back-btn").addEventListener("click", goBack);
    $("next-btn").addEventListener("click", goNext);
  }

  function handleOptionClick(def, value) {
    if (def.type === "single") {
      var prevGroup = state.careerStageGroup;
      state.answers[def.id] = value;
      if (def.id === "careerStage") {
        var newGroup = stageGroupFor(value);
        if (newGroup !== prevGroup) {
          delete state.answers.subjects;
          delete state.answers.field;
          delete state.answers.industry;
        }
        state.careerStageGroup = newGroup;
      }
    } else {
      var current = state.answers[def.id] || [];
      var idx = current.indexOf(value);
      if (idx > -1) {
        current = current.slice(0, idx).concat(current.slice(idx + 1));
        setSelectionMessage("");
      } else {
        if (current.length >= def.max) {
          setSelectionMessage("You can choose up to " + def.max + ". Deselect one first.");
          return;
        }
        current = current.concat([value]);
        setSelectionMessage("");
      }
      state.answers[def.id] = current;
    }
    renderQuestion();
  }

  function setSelectionMessage(msg) {
    var el = $("selection-message");
    if (el) el.textContent = msg;
  }

  function updateNextEnabled(def) {
    var answer = state.answers[def.id];
    var valid = def.type === "multi" ? !!(answer && answer.length) : !!answer;
    $("next-btn").disabled = !valid;
  }

  function goBack() {
    if (state.step > 1) {
      state.step--;
      renderQuestion();
    }
  }

  function goNext() {
    logEvent("step", { sessionId: state.sessionId, stepId: getStepDefinition(state.step).id, timestamp: Date.now() });
    state.lastStepReached = Math.max(state.lastStepReached, state.step);
    if (state.step < TOTAL_STEPS) {
      state.step++;
      renderQuestion();
    } else {
      finishFlow();
    }
  }

  function finishFlow() {
    var scoring = scoreAnswers();
    var clusterNamesSorted = Object.keys(scoring.clusterScores).sort(function (a, b) {
      return scoring.clusterScores[b] - scoring.clusterScores[a];
    });
    var top = rankCareers(scoring);
    logEvent("complete", {
      sessionId: state.sessionId,
      stage: state.answers.careerStage || "",
      region: state.answers.region || "",
      background: state.answers.subjects ? state.answers.subjects.join("; ") : (state.answers.field || state.answers.industry || ""),
      scenario: state.answers.scenario || "",
      cluster1: clusterNamesSorted[0] || "",
      cluster2: clusterNamesSorted[1] || "",
      cluster3: clusterNamesSorted[2] || "",
      topCareer: top[0] ? top[0].career.title : "",
      familiarity: state.answers.familiarity || "",
      timestamp: Date.now()
    });
    renderResults();
  }

  /* ============================== Results ============================== */

  function encodeShareUrl() {
    var base = location.href.split("#")[0];
    var payload = { a: state.answers };
    var json = JSON.stringify(payload);
    var b64 = btoa(unescape(encodeURIComponent(json)));
    return base + "#results=" + b64;
  }

  function decodeShareHash(hash) {
    try {
      var b64 = hash.slice("#results=".length);
      var json = decodeURIComponent(escape(atob(b64)));
      var payload = JSON.parse(json);
      return payload.a || null;
    } catch (e) { return null; }
  }

  function renderResults() {
    state.screen = "results";
    var scoring = scoreAnswers();
    var clusterList = CLUSTERS.map(function (c) {
      return { name: c.name, description: c.description, score: scoring.clusterScores[c.name], contributions: scoring.contributions[c.name] };
    }).sort(function (a, b) { return b.score - a.score; });

    var top3 = clusterList.slice(0, 3);
    var topCluster = clusterList[0];
    var topCareers = rankCareers(scoring);

    var shareUrl = encodeShareUrl();
    if (!state.isRestoredView) {
      try { history.replaceState(null, "", shareUrl); } catch (e) { /* ignore */ }
    }

    var html = "";
    html += renderResultsHero(topCluster, shareUrl);
    html += renderTopClustersSection(top3, scoring.maxPossible);
    html += renderTakeResultsSection(shareUrl);
    html += renderTransitionCard(topCareers);
    html += renderCareersSection(topCareers);
    html += renderSkillsSection(topCareers);
    html += renderTrainingSection(topCareers);
    html += renderNextStepsSection();
    html += '<footer class="disclaimer-footer">GeoMatch by Geothermal Rising &middot; Results are guidance, not a prediction. Explore widely.</footer>';

    $("screen-results").innerHTML = '<div class="results-wrap">' + html + '</div>';
    showScreen("screen-results");
    bindResultsEvents(shareUrl, topCluster, top3, topCareers, scoring);
  }

  function renderResultsHero(topCluster, shareUrl) {
    return (
      '<section class="results-hero">' +
        '<p class="eyebrow">Your geothermal pathway</p>' +
        '<h1 class="hero-title">' + esc(topCluster.name) + '</h1>' +
        '<p class="hero-desc">' + esc(topCluster.description) + '</p>' +
        '<div class="hero-actions">' +
          '<button type="button" class="btn btn-secondary" id="print-btn">Save as PDF</button>' +
          '<button type="button" class="btn btn-secondary" id="email-scroll-btn">Email my results</button>' +
          '<button type="button" class="btn btn-secondary" id="copy-link-btn">Copy share link</button>' +
          '<button type="button" class="btn btn-secondary" id="start-over-btn">Start over</button>' +
        '</div>' +
      '</section>'
    );
  }

  function renderTopClustersSection(top3, maxPossible) {
    var cards = top3.map(function (cluster) {
      var pct = fitPercent(cluster.score, maxPossible);
      var topReasons = cluster.contributions.slice().sort(function (a, b) { return b.points - a.points; }).slice(0, 3).map(function (c) { return c.label; });
      return (
        '<div class="cluster-card card-tick">' +
          '<h3 class="cluster-name">' + esc(cluster.name) + '</h3>' +
          '<div class="fit-row"><div class="fit-bar"><div class="fit-bar-fill" style="width:' + pct + '%"></div></div><span class="fit-pct">' + pct + '% fit</span></div>' +
          '<p class="cluster-desc">' + esc(cluster.description) + '</p>' +
          (topReasons.length ? '<p class="cluster-reason">Because of ' + esc(topReasons.join(", ")) + '.</p>' : '') +
        '</div>'
      );
    }).join("");
    return (
      '<section class="top-clusters-section">' +
        '<div class="section-header"><p class="eyebrow-small">Top matches</p><h2 class="section-title">Your top career clusters</h2>' +
        '<p class="fit-explainer">Fit shows how strongly your answers point to each cluster.</p></div>' +
        '<div class="cluster-grid">' + cards + '</div>' +
      '</section>'
    );
  }

  function renderTakeResultsSection(shareUrl) {
    var isLocal = location.protocol === "file:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
    var qrNote = isLocal ? '<p class="qr-note">QR codes only open on phones once GeoMatch is hosted online.</p>' : "";
    return (
      '<section class="take-results-section card-tick">' +
        '<h2 class="section-title">Take your results with you</h2>' +
        '<div class="take-results-grid">' +
          '<div class="email-panel">' + renderEmailPanel() + '</div>' +
          '<div class="qr-panel">' +
            '<p class="eyebrow-small">Scan or copy</p>' +
            '<div id="qr-holder" class="qr-holder"></div>' +
            qrNote +
            '<p class="share-link-text" id="share-link-text">' + esc(shareUrl) + '</p>' +
          '</div>' +
        '</div>' +
      '</section>'
    );
  }

  function renderEmailPanel() {
    var stage = state.answers.careerStage;
    var showGuardian = stage === "Middle School";
    var showUnder18Note = stage === "Middle School" || stage === "High School";
    return (
      '<h3 class="email-heading">Email my results</h3>' +
      '<p class="email-helper">Send a copy of your results to yourself. Geothermal Rising keeps a record of your email and results so we can understand who uses GeoMatch. We never sell or share it. ' +
      '<a href="#" id="privacy-link">How we use your email</a></p>' +
      (showUnder18Note ? '<p class="under18-note">If you\'re under 18, check with a parent, guardian or teacher before sharing your email.</p>' : "") +
      '<label class="field-label" for="email-input">Your email address</label>' +
      '<input type="email" id="email-input" class="text-input" autocomplete="email" inputmode="email" placeholder="you@example.com" value="' + esc(state.email) + '" />' +
      '<label class="checkbox-row"><input type="checkbox" id="consent-checkbox" /><span>Send my results to this address. I agree that Geothermal Rising can keep a record of my email and results.</span></label>' +
      (showGuardian ? '<label class="checkbox-row"><input type="checkbox" id="guardian-checkbox" /><span>A parent, guardian or teacher said it\'s OK for me to share my email.</span></label>' : "") +
      '<label class="checkbox-row"><input type="checkbox" id="followup-checkbox" /><span>Also send me occasional updates about geothermal careers, events and student opportunities.</span></label>' +
      '<button type="button" class="btn btn-primary" id="send-email-btn">Send</button>' +
      '<div class="field-error" id="email-message" aria-live="polite"></div>'
    );
  }

  function renderTransitionCard(topCareers) {
    if (state.careerStageGroup !== "professional") return "";
    var industry = state.answers.industry;
    if (!industry || industry === "Other") return "";
    var map = TRANSITION_MAP[industry];
    if (!map) return "";
    var relevant = (window.GEOMATCH_CAREERS || [])
      .filter(function (c) { return (c.industries_transferable_from || []).indexOf(industry) > -1; });
    var scoring = scoreAnswers();
    var ranked = rankCareers(scoring);
    var rankedTitles = ranked.map(function (r) { return r.career.title; });
    var ordered = relevant.slice().sort(function (a, b) {
      var ia = rankedTitles.indexOf(a.title), ib = rankedTitles.indexOf(b.title);
      if (ia === -1) ia = 999; if (ib === -1) ib = 999;
      return ia - ib;
    }).slice(0, 5);

    return (
      '<section class="transition-card card-tick">' +
        '<h2 class="section-title">Your skills transfer into geothermal</h2>' +
        '<div class="transition-grid">' +
          '<div><p class="eyebrow-small">Skills you already have</p><ul class="plain-list">' + map.have.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + '</ul></div>' +
          '<div><p class="eyebrow-small">Geothermal roles that use them</p><ul class="plain-list">' + ordered.map(function (c) { return "<li>" + esc(c.title) + "</li>"; }).join("") + '</ul></div>' +
          '<div><p class="eyebrow-small">Suggested upskilling</p><ul class="plain-list">' + map.upskill.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + '</ul></div>' +
        '</div>' +
      '</section>'
    );
  }

  function renderCareersSection(topCareers) {
    var cards = topCareers.map(function (item) {
      var career = item.career;
      var matches = [].concat(item.matchedInterests, item.matchedActivities, item.matchedEnvironments);
      if (item.matchedField) matches.push(item.matchedField);
      if (item.industryMatches) matches.push(state.answers.industry);
      return (
        '<article class="career-card card-tick">' +
          '<div class="career-card-top">' +
            '<span class="tag tag-moss">' + esc(career.category) + '</span>' +
            '<span class="tag tag-outline">' + esc(ENTRY_ROUTE_LABELS[career.entry_route] || career.entry_route) + '</span>' +
          '</div>' +
          '<h3 class="career-title">' + esc(career.title) + '</h3>' +
          '<p class="career-desc">' + esc(career.description) + '</p>' +
          (matches.length ? '<p class="career-matches">Matches you on: ' + esc(uniq(matches).join(", ")) + '</p>' : "") +
          '<div class="career-detail-grid">' +
            '<div><p class="eyebrow-small">Typical tasks</p><ul class="plain-list">' + career.typical_tasks.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + '</ul></div>' +
            '<div><p class="eyebrow-small">Key skills</p><ul class="plain-list">' + career.skills.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + '</ul></div>' +
            '<div><p class="eyebrow-small">Degrees &amp; training</p><ul class="plain-list">' + career.degrees.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + '</ul></div>' +
            '<div><p class="eyebrow-small">Useful courses</p><ul class="plain-list">' + career.courses.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + '</ul></div>' +
          '</div>' +
        '</article>'
      );
    }).join("");
    return (
      '<section class="careers-section">' +
        '<div class="section-header"><p class="eyebrow-small">Top matches</p><h2 class="section-title">Careers to explore</h2></div>' +
        '<div class="career-grid">' + cards + '</div>' +
      '</section>'
    );
  }

  function renderSkillsSection(topCareers) {
    var skills = [];
    topCareers.forEach(function (item) { (item.career.skills || []).forEach(function (s) { skills.push(s); }); });
    skills = uniq(skills).slice(0, 10);
    return (
      '<section class="skills-section card-tick">' +
        '<h2 class="section-title">Skills to develop</h2>' +
        '<div class="pill-row">' + skills.map(function (s) { return '<span class="pill">' + esc(s) + '</span>'; }).join("") + '</div>' +
      '</section>'
    );
  }

  function renderTrainingSection(topCareers) {
    var group = state.careerStageGroup;
    var careers = topCareers.map(function (t) { return t.career; });
    var fields = uniq([].concat.apply([], careers.map(function (c) { return c.fields || []; })));

    if (group === "school") {
      var subjects = SUBJECT_OPTIONS.filter(function (subject) {
        return SUBJECT_FIELD_MAP[subject].some(function (f) { return fields.indexOf(f) > -1; });
      });
      var entryRoutes = uniq(careers.map(function (c) { return c.entry_route; })).map(function (r) { return ENTRY_ROUTE_LABELS[r] || r; });
      return (
        '<section class="training-section card-tick">' +
          '<h2 class="section-title">What to study next</h2>' +
          '<div class="training-grid">' +
            '<div><p class="eyebrow-small">Subjects that lead here</p><ul class="plain-list">' + subjects.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + '</ul></div>' +
            '<div><p class="eyebrow-small">Later study</p><ul class="plain-list">' + fields.map(function (f) { return "<li>" + esc(f) + " (later study)</li>"; }).join("") + '</ul></div>' +
            '<div><p class="eyebrow-small">Entry routes</p><ul class="plain-list">' + entryRoutes.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + '</ul></div>' +
          '</div>' +
        '</section>'
      );
    }

    var degrees = uniq([].concat.apply([], careers.map(function (c) { return c.degrees || []; })));
    var courses = uniq([].concat.apply([], careers.map(function (c) { return c.courses || []; })));
    return (
      '<section class="training-section card-tick">' +
        '<h2 class="section-title">Degrees and training</h2>' +
        '<div class="training-grid">' +
          '<div><p class="eyebrow-small">Degrees</p><ul class="plain-list">' + degrees.map(function (d) { return "<li>" + esc(d) + "</li>"; }).join("") + '</ul></div>' +
          '<div><p class="eyebrow-small">Courses</p><ul class="plain-list">' + courses.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + '</ul></div>' +
        '</div>' +
      '</section>'
    );
  }

  function renderNextStepsSection() {
    var group = state.careerStageGroup;
    var items = [];
    if (group === "school") {
      items = [
        "Keep up the subjects that lead to your matched fields.",
        "Look for science fairs, field trips, coding clubs and job shadowing.",
        "Ask a teacher or counsellor about programs in these areas."
      ];
    } else if (group === "tertiary") {
      items = [
        "Add a specific course from your matched list to your next term.",
        "Look for internships, field schools and research projects.",
        "Build a portfolio piece related to your top matched career.",
        "Attend a conference or webinar — many offer student rates."
      ];
    } else {
      items = [
        "Rewrite your CV in geothermal terms using your transferable skills.",
        "Take short training in the courses listed for your top matches.",
        "Explore roles like your top match on geothermal job boards and professional networks."
      ];
    }
    items.push("Connect with Geothermal Rising for events, news and opportunities.");
    return (
      '<section class="next-steps-section card-tick">' +
        '<h2 class="section-title">Next steps</h2>' +
        '<ul class="plain-list next-steps-list">' + items.map(function (i) { return "<li>" + esc(i) + "</li>"; }).join("") + '</ul>' +
      '</section>'
    );
  }

  /* ============================== Results interactions ============================== */

  function bindResultsEvents(shareUrl, topCluster, top3, topCareers, scoring) {
    renderQrCode(shareUrl);

    $("print-btn").addEventListener("click", function () { window.print(); });
    $("email-scroll-btn").addEventListener("click", function () {
      var panel = document.querySelector(".take-results-section");
      if (panel) panel.scrollIntoView({ behavior: "smooth" });
      var input = $("email-input");
      if (input) input.focus();
    });
    $("copy-link-btn").addEventListener("click", function () { copyToClipboard(shareUrl); });
    $("start-over-btn").addEventListener("click", function () { goHome(); });

    var privacyLink = $("privacy-link");
    if (privacyLink) privacyLink.addEventListener("click", function (e) { e.preventDefault(); openPrivacyModal(); });

    var emailInput = $("email-input");
    if (emailInput) emailInput.addEventListener("input", function () { state.email = emailInput.value; });
    var followupBox = $("followup-checkbox");
    if (followupBox) followupBox.addEventListener("change", function () { state.followUp = followupBox.checked; });
    var guardianBox = $("guardian-checkbox");
    if (guardianBox) guardianBox.addEventListener("change", function () { state.guardianConsent = guardianBox.checked; });

    var sendBtn = $("send-email-btn");
    if (sendBtn) sendBtn.addEventListener("click", function () { handleSendEmail(shareUrl, topCluster, top3, topCareers); });
  }

  function renderQrCode(shareUrl) {
    var holder = $("qr-holder");
    if (!holder || !window.QRCodeGen) return;
    try {
      holder.innerHTML = window.QRCodeGen.generateSvg(shareUrl, { ecLevel: "M", cellSize: 4 });
    } catch (e) {
      holder.innerHTML = "";
    }
  }

  function copyToClipboard(text) {
    var btn = $("copy-link-btn");
    function done(ok) {
      if (btn) {
        var original = "Copy share link";
        btn.textContent = ok ? "Copied!" : "Copy failed";
        setTimeout(function () { btn.textContent = original; }, 1800);
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } else {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        done(true);
      } catch (e) { done(false); }
    }
  }

  /* ============================== Privacy modal ============================== */

  function openPrivacyModal() {
    $("privacy-modal-body").innerHTML =
      '<p><strong>What we keep:</strong> your email address and a summary of your GeoMatch results (your top clusters, top career and the stage/region you selected).</p>' +
      '<p><strong>Why:</strong> to send you your results, to measure how many people use GeoMatch, and — only if you tick the box — to send occasional updates.</p>' +
      '<p><strong>Who sees it:</strong> Geothermal Rising staff only. We never sell or share your information.</p>' +
      '<p><strong>Your choices:</strong> to ask for your record to be deleted, contact ' + esc(CONFIG.privacyContact) + '.</p>';
    $("privacy-modal").hidden = false;
  }
  function closePrivacyModal() { $("privacy-modal").hidden = true; }

  /* ============================== Email feature ============================== */

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function handleSendEmail(shareUrl, topCluster, top3, topCareers) {
    var emailInput = $("email-input");
    var consentBox = $("consent-checkbox");
    var guardianBox = $("guardian-checkbox");
    var msgEl = $("email-message");
    var email = (emailInput.value || "").trim();

    if (!isValidEmail(email)) {
      msgEl.textContent = "Please enter a valid email address.";
      return;
    }
    if (!consentBox.checked) {
      msgEl.textContent = "Please tick the box to confirm.";
      return;
    }
    if (guardianBox && !guardianBox.checked) {
      msgEl.textContent = "Please tick the box to confirm.";
      return;
    }
    if (state.emailSendCount >= 3) {
      msgEl.textContent = "You've reached the limit for this results view. Scan the QR code or copy your link instead.";
      return;
    }

    msgEl.textContent = "";
    var content = buildEmailContent(shareUrl, topCluster, top3, topCareers);
    var normalizedEmail = email.trim().toLowerCase();
    var followUp = !!$("followup-checkbox").checked;
    var guardianConsent = guardianBox ? guardianBox.checked : null;

    var record = buildEmailRecord(normalizedEmail, followUp, guardianConsent, topCluster, topCareers, "endpoint");

    if (CONFIG.emailEndpoint) {
      sendViaEndpoint(normalizedEmail, content, shareUrl, record, msgEl, emailInput, consentBox, guardianBox);
    } else {
      sendViaMailto(normalizedEmail, content, shareUrl);
      record.method = "mailto";
      storeEmailRecord(record);
      state.emailSendCount++;
      console.warn("[GeoMatch] emailEndpoint is not set. On a shared device the mailto: fallback opens that device's Mail app. Set up the endpoint before using GeoMatch at an event.");
      msgEl.textContent = "Sent. Check your inbox (and your junk folder).";
      clearEmailFields(emailInput, consentBox, guardianBox);
    }
  }

  function sendViaEndpoint(email, content, shareUrl, record, msgEl, emailInput, consentBox, guardianBox) {
    var sendBtn = $("send-email-btn");
    sendBtn.disabled = true;

    var controller = (typeof AbortController !== "undefined") ? new AbortController() : null;
    var timeoutId = setTimeout(function () { if (controller) controller.abort(); }, 10000);

    var body = JSON.stringify({
      to: email,
      subject: content.subject,
      text: content.text,
      html: content.html,
      shareUrl: shareUrl,
      record: record
    });

    fetch(CONFIG.emailEndpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: body,
      signal: controller ? controller.signal : undefined
    }).then(function () {
      clearTimeout(timeoutId);
      sendBtn.disabled = false;
      record.method = "endpoint";
      storeEmailRecord(record);
      state.emailSendCount++;
      msgEl.textContent = "Sent. Check your inbox (and your junk folder).";
      clearEmailFields(emailInput, consentBox, guardianBox);
    }).catch(function () {
      clearTimeout(timeoutId);
      sendBtn.disabled = false;
      msgEl.textContent = "We couldn't send that right now. Scan the QR code or copy your link instead.";
    });
  }

  function sendViaMailto(email, content, shareUrl) {
    var body = content.text;
    var mailto = "mailto:" + encodeURIComponent(email) + "?subject=" + encodeURIComponent(content.subject) + "&body=" + encodeURIComponent(body);
    if (mailto.length > 1800) {
      var trimmedText = content.textShort || content.text;
      mailto = "mailto:" + encodeURIComponent(email) + "?subject=" + encodeURIComponent(content.subject) + "&body=" + encodeURIComponent(trimmedText);
    }
    if (mailto.length > 1800) {
      var minimal = "Here are your GeoMatch geothermal career results.\n\nReopen your full results: " + shareUrl;
      mailto = "mailto:" + encodeURIComponent(email) + "?subject=" + encodeURIComponent(content.subject) + "&body=" + encodeURIComponent(minimal);
    }
    window.location.href = mailto;
  }

  function clearEmailFields(emailInput, consentBox, guardianBox) {
    emailInput.value = "";
    consentBox.checked = false;
    if (guardianBox) guardianBox.checked = false;
    var followupBox = $("followup-checkbox");
    if (followupBox) followupBox.checked = false;
    state.email = "";
    state.followUp = false;
    state.guardianConsent = false;
  }

  function buildEmailContent(shareUrl, topCluster, top3, topCareers) {
    var maxPossible = scoreAnswers().maxPossible;
    var subject = "Your GeoMatch results: " + topCluster.name;

    var clusterLines = top3.map(function (c) { return "- " + c.name + " (" + fitPercent(c.score, maxPossible) + "% fit)"; }).join("\n");
    var careerLines = topCareers.map(function (item) {
      return "- " + item.career.title + " (" + (ENTRY_ROUTE_LABELS[item.career.entry_route] || item.career.entry_route) + "): " + item.career.description;
    }).join("\n");
    var skills = uniq([].concat.apply([], topCareers.map(function (t) { return t.career.skills || []; }))).slice(0, 6);
    var fields = uniq([].concat.apply([], topCareers.map(function (t) { return t.career.fields || []; })));
    var studyLines;
    if (state.careerStageGroup === "school") {
      studyLines = fields.slice(0, 6).map(function (f) { return "- " + f + " (later study)"; }).join("\n");
    } else {
      var degrees = uniq([].concat.apply([], topCareers.map(function (t) { return t.career.degrees || []; }))).slice(0, 6);
      studyLines = degrees.map(function (d) { return "- " + d; }).join("\n");
    }
    var nextSteps = nextStepsPlainList();

    var text =
      "Here are your GeoMatch geothermal career results.\n\n" +
      "Top clusters:\n" + clusterLines + "\n\n" +
      "Top careers:\n" + careerLines + "\n\n" +
      "Skills to develop:\n" + skills.map(function (s) { return "- " + s; }).join("\n") + "\n\n" +
      (state.careerStageGroup === "school" ? "What to study next:\n" : "Degrees and training:\n") + studyLines + "\n\n" +
      "Next steps:\n" + nextSteps.map(function (s) { return "- " + s; }).join("\n") + "\n\n" +
      "Reopen your full results: " + shareUrl + "\n\n" +
      "GeoMatch by Geothermal Rising. Results are guidance, not a prediction. You received this because you requested it at GeoMatch. No further emails will be sent.";

    var textShort =
      "Here are your GeoMatch geothermal career results.\n\n" +
      "Top cluster: " + topCluster.name + "\n" +
      "Top career: " + (topCareers[0] ? topCareers[0].career.title : "") + "\n\n" +
      "Reopen your full results: " + shareUrl + "\n\n" +
      "GeoMatch by Geothermal Rising. Results are guidance, not a prediction.";

    var html =
      '<div style="font-family:\'Red Hat Text\',Tahoma,sans-serif;max-width:600px;margin:0 auto;color:#000;">' +
      '<h1 style="font-family:\'Red Hat Display\',Tahoma,sans-serif;">Your GeoMatch results</h1>' +
      '<p>Here are your GeoMatch geothermal career results.</p>' +
      '<h2>Top clusters</h2><ul>' + top3.map(function (c) { return "<li>" + esc(c.name) + " (" + fitPercent(c.score, maxPossible) + "% fit)</li>"; }).join("") + '</ul>' +
      '<h2>Top careers</h2><ul>' + topCareers.map(function (item) { return "<li><strong>" + esc(item.career.title) + "</strong> (" + esc(ENTRY_ROUTE_LABELS[item.career.entry_route] || item.career.entry_route) + "): " + esc(item.career.description) + "</li>"; }).join("") + '</ul>' +
      '<h2>Skills to develop</h2><ul>' + skills.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + '</ul>' +
      '<p style="text-align:center;margin:24px 0;">' +
      '<a href="' + esc(shareUrl) + '" style="background:#FDC40F;color:#000;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;display:inline-block;">Reopen your full results</a>' +
      '</p>' +
      '<p style="font-size:12px;color:#555;">GeoMatch by Geothermal Rising. Results are guidance, not a prediction. You received this because you requested it at GeoMatch. No further emails will be sent.</p>' +
      '</div>';

    return { subject: subject, text: text, textShort: textShort, html: html };
  }

  function nextStepsPlainList() {
    var group = state.careerStageGroup;
    if (group === "school") return ["Keep up the subjects that lead to your matched fields.", "Look for science fairs, field trips, coding clubs and job shadowing.", "Ask a teacher or counsellor about programs in these areas.", "Connect with Geothermal Rising for events, news and opportunities."];
    if (group === "tertiary") return ["Add a specific course from your matched list to your next term.", "Look for internships, field schools and research projects.", "Build a portfolio piece related to your top matched career.", "Connect with Geothermal Rising for events, news and opportunities."];
    return ["Rewrite your CV in geothermal terms using your transferable skills.", "Take short training in the courses listed for your top matches.", "Explore roles like your top match on geothermal job boards and professional networks.", "Connect with Geothermal Rising for events, news and opportunities."];
  }

  function buildEmailRecord(email, followUp, guardianConsent, topCluster, topCareers, method) {
    var scoring = scoreAnswers();
    var clusterNamesSorted = Object.keys(scoring.clusterScores).sort(function (a, b) { return scoring.clusterScores[b] - scoring.clusterScores[a]; });
    return {
      timestamp: Date.now(),
      email: email,
      method: method,
      stage: state.answers.careerStage || "",
      region: state.answers.region || "",
      background: state.answers.subjects ? state.answers.subjects.join("; ") : (state.answers.field || state.answers.industry || ""),
      cluster1: clusterNamesSorted[0] || "",
      cluster2: clusterNamesSorted[1] || "",
      cluster3: clusterNamesSorted[2] || "",
      career1: topCareers[0] ? topCareers[0].career.title : "",
      familiarity: state.answers.familiarity || "",
      followUp: !!followUp,
      guardianConsent: guardianConsent === null ? "" : !!guardianConsent,
      sessionId: state.sessionId
    };
  }

  function storeEmailRecord(record) {
    var records = safeLocalStorageGet("geomatch_emails", []);
    records.push(record);
    safeLocalStorageSet("geomatch_emails", records);
  }

  /* ============================== Analytics ============================== */

  function logEvent(type, payload) {
    try {
      var events = safeLocalStorageGet("geomatch_events", []);
      events.push(Object.assign({ type: type }, payload));
      if (events.length > 5000) events = events.slice(events.length - 5000);
      safeLocalStorageSet("geomatch_events", events);
    } catch (e) { /* ignore */ }

    if (type === "complete" && CONFIG.analyticsEndpoint) {
      try {
        fetch(CONFIG.analyticsEndpoint, {
          method: "POST",
          mode: "no-cors",
          keepalive: true,
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify(Object.assign({ type: type }, payload))
        }).catch(function () { /* fail silently */ });
      } catch (e) { /* fail silently */ }
    }
  }

  /* ============================== Admin / staff view ============================== */

  var adminUnlocked = false;

  function renderAdminGate() {
    $("pin-modal").hidden = false;
    $("pin-error").textContent = "";
    $("pin-input").value = "";
    $("pin-input").focus();
  }

  function checkAdminPin() {
    var val = $("pin-input").value;
    if (val === CONFIG.adminPin) {
      adminUnlocked = true;
      $("pin-modal").hidden = true;
      renderAdmin();
    } else {
      $("pin-error").textContent = "Incorrect PIN.";
    }
  }

  function renderAdmin() {
    if (!adminUnlocked) { renderAdminGate(); return; }
    state.screen = "admin";
    var events = safeLocalStorageGet("geomatch_events", []);
    var emails = safeLocalStorageGet("geomatch_emails", []);

    var starts = events.filter(function (e) { return e.type === "start"; });
    var completes = events.filter(function (e) { return e.type === "complete"; });
    var completionPct = starts.length ? Math.round((completes.length / starts.length) * 100) : 0;

    function tally(list, key) {
      var counts = {};
      list.forEach(function (item) { var v = item[key] || "(blank)"; counts[v] = (counts[v] || 0) + 1; });
      return Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).map(function (k) { return { label: k, count: counts[k] }; });
    }

    function tableHtml(title, rows) {
      return '<div class="admin-table-card"><h3>' + esc(title) + '</h3><table class="admin-table"><tbody>' +
        rows.slice(0, 10).map(function (r) { return "<tr><td>" + esc(r.label) + "</td><td>" + r.count + "</td></tr>"; }).join("") +
        '</tbody></table></div>';
    }

    // Where sessions ended: last step reached per session among sessions that started but didn't complete
    var completedSessionIds = {};
    completes.forEach(function (c) { completedSessionIds[c.sessionId] = true; });
    var lastStepBySession = {};
    events.filter(function (e) { return e.type === "step"; }).forEach(function (e) {
      lastStepBySession[e.sessionId] = e.stepId;
    });
    var dropoffRows = tally(Object.keys(lastStepBySession)
      .filter(function (sid) { return !completedSessionIds[sid]; })
      .map(function (sid) { return { stepId: lastStepBySession[sid] }; }), "stepId");

    var uniqueEmails = uniq(emails.map(function (e) { return e.email; })).length;
    var followUpCount = emails.filter(function (e) { return e.followUp; }).length;
    var endpointCount = emails.filter(function (e) { return e.method === "endpoint"; }).length;
    var mailtoCount = emails.filter(function (e) { return e.method === "mailto"; }).length;
    var latestEmails = emails.slice(-20).reverse();

    $("screen-admin").innerHTML =
      '<div class="admin-wrap">' +
        '<div class="admin-header"><h1>Staff view &middot; this device only</h1><button type="button" class="btn btn-secondary" id="admin-back-btn">Back to app</button></div>' +
        '<div class="admin-stat-row">' +
          '<div class="stat"><div class="stat-num">' + starts.length + '</div><div class="stat-label">Started</div></div>' +
          '<div class="stat"><div class="stat-num">' + completes.length + '</div><div class="stat-label">Completed</div></div>' +
          '<div class="stat"><div class="stat-num">' + completionPct + '%</div><div class="stat-label">Completion</div></div>' +
        '</div>' +
        '<div class="admin-table-grid">' +
          tableHtml("Top cluster", tally(completes, "cluster1")) +
          tableHtml("Career stage", tally(completes, "stage")) +
          tableHtml("Region", tally(completes, "region")) +
          tableHtml("Prior familiarity", tally(completes, "familiarity")) +
          tableHtml("Top career", tally(completes, "topCareer")) +
          tableHtml("Where sessions ended (last step reached)", dropoffRows) +
        '</div>' +
        '<button type="button" class="btn btn-secondary" id="download-csv-btn">Download CSV</button>' +
        '<div class="admin-email-panel">' +
          '<h2>Email records</h2>' +
          '<div class="admin-stat-row">' +
            '<div class="stat"><div class="stat-num">' + emails.length + '</div><div class="stat-label">Total emails</div></div>' +
            '<div class="stat"><div class="stat-num">' + uniqueEmails + '</div><div class="stat-label">Unique addresses</div></div>' +
            '<div class="stat"><div class="stat-num">' + followUpCount + '</div><div class="stat-label">Follow-up opt-ins</div></div>' +
            '<div class="stat"><div class="stat-num">' + endpointCount + ' / ' + mailtoCount + '</div><div class="stat-label">Endpoint / mailto</div></div>' +
          '</div>' +
          '<table class="admin-table"><thead><tr><th>Email</th><th>Date</th><th>Top cluster</th><th>Follow-up</th></tr></thead><tbody>' +
          latestEmails.map(function (e) {
            return "<tr><td>" + esc(e.email) + "</td><td>" + esc(new Date(e.timestamp).toLocaleString()) + "</td><td>" + esc(e.cluster1) + "</td><td>" + (e.followUp ? "Yes" : "No") + "</td></tr>";
          }).join("") +
          '</tbody></table>' +
          '<div class="admin-actions">' +
            '<button type="button" class="btn btn-secondary" id="download-email-csv-btn">Download email CSV</button>' +
            '<button type="button" class="btn btn-secondary" id="clear-emails-btn">Clear email records</button>' +
          '</div>' +
        '</div>' +
        '<button type="button" class="btn btn-secondary danger" id="clear-device-btn">Clear device data</button>' +
      '</div>';

    showScreen("screen-admin");

    $("admin-back-btn").addEventListener("click", goHome);
    $("download-csv-btn").addEventListener("click", function () { downloadCsv(completes, ["sessionId", "stage", "region", "background", "scenario", "cluster1", "cluster2", "cluster3", "topCareer", "familiarity", "timestamp"], "geomatch_completions.csv"); });
    $("download-email-csv-btn").addEventListener("click", function () { downloadCsv(emails, ["timestamp", "email", "method", "stage", "region", "background", "cluster1", "cluster2", "cluster3", "career1", "familiarity", "followUp", "guardianConsent", "sessionId"], "geomatch_emails.csv"); });
    $("clear-emails-btn").addEventListener("click", function () {
      if (confirm("Clear all email records from this device? This cannot be undone.")) {
        safeLocalStorageSet("geomatch_emails", []);
        renderAdmin();
      }
    });
    $("clear-device-btn").addEventListener("click", function () {
      if (confirm("Clear all anonymous analytics data from this device? This cannot be undone.")) {
        safeLocalStorageSet("geomatch_events", []);
        renderAdmin();
      }
    });
  }

  function downloadCsv(rows, columns, filename) {
    var lines = [columns.join(",")];
    rows.forEach(function (row) {
      lines.push(columns.map(function (col) {
        var val = row[col] == null ? "" : String(row[col]);
        return '"' + val.replace(/"/g, '""') + '"';
      }).join(","));
    });
    var blob = new Blob([lines.join("\n")], { type: "text/csv" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ============================== Idle reset ============================== */

  var idleTimer = null, idleCountdownTimer = null;

  function resetIdleTimer() {
    if (state.screen !== "question" && state.screen !== "results") return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(showIdleOverlay, CONFIG.idleSeconds * 1000);
  }

  function showIdleOverlay() {
    if (state.screen !== "question" && state.screen !== "results") return;
    $("idle-overlay").hidden = false;
    idleCountdownTimer = setTimeout(function () {
      $("idle-overlay").hidden = true;
      goHome();
    }, 15000);
  }

  function dismissIdleOverlay() {
    clearTimeout(idleCountdownTimer);
    $("idle-overlay").hidden = true;
    resetIdleTimer();
  }

  function bindIdleListeners() {
    ["click", "keydown", "touchstart"].forEach(function (type) {
      document.addEventListener(type, function () {
        if (!$("idle-overlay").hidden) return;
        resetIdleTimer();
      }, { passive: true });
    });
    $("idle-continue-btn").addEventListener("click", dismissIdleOverlay);
  }

  /* ============================== Router / boot ============================== */

  function handleHashChange() {
    var hash = location.hash;
    if (hash === "#admin") {
      renderAdmin();
      return;
    }
    if (hash.indexOf("#results=") === 0) {
      var answers = decodeShareHash(hash);
      if (answers) {
        state.answers = answers;
        state.careerStageGroup = stageGroupFor(answers.careerStage);
        state.isRestoredView = true;
        renderResults();
        return;
      }
    }
    if (!hash) {
      renderLanding();
    }
  }

  function boot() {
    buildClusterProfiles();
    validateCareerData();
    renderTopbar();
    bindIdleListeners();
    resetIdleTimer();

    $("privacy-modal-close-btn").addEventListener("click", closePrivacyModal);
    $("pin-cancel-btn").addEventListener("click", function () { $("pin-modal").hidden = true; goHome(); });
    $("pin-submit-btn").addEventListener("click", checkAdminPin);
    $("pin-input").addEventListener("keydown", function (e) { if (e.key === "Enter") checkAdminPin(); });

    window.addEventListener("hashchange", handleHashChange);

    if (location.hash === "#admin" || location.hash.indexOf("#results=") === 0) {
      handleHashChange();
    } else {
      renderLanding();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.GeoMatchConfig = CONFIG;
})();
