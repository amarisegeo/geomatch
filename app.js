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
    analyticsEndpoint: "https://script.google.com/macros/s/AKfycbxZZfdsUkH1ntV15XpQwcYq8Jvd8Y4ky-UjiGWGgQ_qr4F2lhRRMd-Bg7_aj2f11WJNZw/exec",
    emailEndpoint: "https://script.google.com/macros/s/AKfycbxZZfdsUkH1ntV15XpQwcYq8Jvd8Y4ky-UjiGWGgQ_qr4F2lhRRMd-Bg7_aj2f11WJNZw/exec",
    adminPin: "1234",
    privacyContact: "amarise@geothermal.org",
    middleSchoolEmail: true,
    links: {
      jobBoard: "https://www.geothermal.org/resources/job-board",
      geothermalRising: "https://www.geothermal.org",
      studentResources: "https://www.geothermal.org/index.php/resources/students",
      studentCommittee: "https://www.geothermal.org/index.php/our-organization/geothermal-rising-student-committee",
      membership: "https://www.geothermal.org/index.php/our-organization/membership",
      events: "https://www.geothermal.org/events",
      learn: ""
    }
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

  function joinAnd(arr) {
    if (!arr || !arr.length) return "";
    if (arr.length === 1) return arr[0];
    if (arr.length === 2) return arr[0] + " and " + arr[1];
    return arr.slice(0, -1).join(", ") + ", and " + arr[arr.length - 1];
  }

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

  var MS_SUBJECT_FIELD_MAP = {
    "Math": ["Mathematics", "Data Science", "Finance"],
    "Science": ["Geology", "Earth Science", "Environmental Science", "Physics", "Chemistry", "Biology"],
    "English & Media": ["Communications", "Marketing", "Education"],
    "Social Studies & Government": ["Public Policy", "Law", "Geography"],
    "Computer Science": ["Computer Science", "Data Science"],
    "Design & Technology": ["Mechanical Engineering", "Civil Engineering", "Technical / Trades Program"]
  };
  var MS_SUBJECT_OPTIONS = Object.keys(MS_SUBJECT_FIELD_MAP);
  var MS_SUBJECT_HINTS = { "Design & Technology": "Building, making or shop class" };

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
    { id: "find-heat", label: "Find out whether there's enough heat underground to justify a project", labelMS: "Find where the Earth's heat is hiding underground", short: "find geothermal heat underground", clusters: ["Exploration & Earth Sciences", "Reservoir Engineering"] },
    { id: "drill-wells", label: "Plan and drill wells that reach hot rock kilometres below the surface", labelMS: "Drill deep holes to reach the hot rock", short: "drill geothermal wells", clusters: ["Drilling & Well Construction"] },
    { id: "design-plant", label: "Design the plant that turns hot fluid into electricity", labelMS: "Design the machines that turn heat into electricity", short: "design the power plant", clusters: ["Mechanical Engineering", "Electrical Engineering", "Chemical & Process Engineering"] },
    { id: "run-plant", label: "Run and maintain the plant once it's generating power", labelMS: "Keep the power plant running every day", short: "keep the plant running", clusters: ["Plant Operations & Maintenance", "Skilled Trades"] },
    { id: "build-site", label: "Build the roads, well pads and pipelines on site", labelMS: "Build the roads, pipes and buildings", short: "build the site and pipelines", clusters: ["Civil Engineering", "Skilled Trades"] },
    { id: "direct-use", label: "Use the heat directly for buildings, greenhouses or industry", labelMS: "Use the Earth's heat to warm buildings or grow food in greenhouses", short: "use geothermal heat directly", clusters: ["Heat Pumps & Direct Use"] },
    { id: "protect-environment", label: "Protect the local environment and assess project impacts", labelMS: "Protect the plants, animals and water nearby", short: "protect the environment", clusters: ["Environmental & Sustainability"] },
    { id: "funding-policy", label: "Secure the funding, contracts and supportive policies", labelMS: "Plan the money and the rules", short: "handle the funding and policy", clusters: ["Business & Commercial", "Policy & Law", "Leadership & Management"] },
    { id: "data-systems", label: "Build the data systems and models that monitor everything", labelMS: "Use computers to keep watch over everything", short: "build data systems", clusters: ["Data & Digital Technology"] },
    { id: "research-tech", label: "Research new technology so geothermal can work almost anywhere", labelMS: "Invent new ways to use the Earth's heat", short: "research new technology", clusters: ["Research & Academia"] },
    { id: "explain-community", label: "Explain the project to communities, schools and decision-makers", labelMS: "Tell the community about the project", short: "explain the project to communities", clusters: ["Communications, Outreach & Education"] }
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
  var ENVIRONMENT_MS_LABELS = {
    "Field sites": "Outdoors in nature", "Power plant": "At a power plant", "Lab": "In a science lab",
    "Construction site": "On building sites", "Office": "In an office", "Remote / hybrid": "On a computer from anywhere",
    "University": "At a university", "Community settings": "Out in the community"
  };
  var ENV_PHRASES = {
    "Field sites": "outdoors at field sites", "Power plant": "at a power plant", "Lab": "in a lab",
    "Construction site": "on construction sites", "Office": "in an office", "Remote / hybrid": "remotely",
    "University": "at a university", "Government": "in government", "Community settings": "in the community"
  };

  var FAMILIARITY_OPTIONS = [
    "Not at all", "I'd heard of it", "I knew the basics", "I've studied or worked in it"
  ];

  var FREE_TIME_OPTIONS = [
    { label: "Camping, hiking or exploring outdoors", short: "exploring outdoors", weight: 1, clusters: ["Exploration & Earth Sciences", "Environmental & Sustainability"] },
    { label: "Playing video games", short: "video games", weight: 1, clusters: ["Data & Digital Technology"] },
    { label: "Coding or making apps and websites", short: "coding", weight: 1, clusters: ["Data & Digital Technology"] },
    { label: "Building or fixing things (LEGO, bikes, models)", short: "building and fixing things", weight: 1, clusters: ["Skilled Trades", "Mechanical Engineering", "Civil Engineering"] },
    { label: "Science kits and experiments", short: "science experiments", weight: 1, clusters: ["Research & Academia", "Chemical & Process Engineering"] },
    { label: "Puzzles, chess or brain teasers", short: "puzzles", weight: 1, clusters: ["Reservoir Engineering", "Data & Digital Technology"] },
    { label: "Making videos, drawing or posting content", short: "making videos and content", weight: 1, clusters: ["Communications, Outreach & Education"] },
    { label: "Gardening, nature or caring for animals", short: "nature and animals", weight: 1, clusters: ["Environmental & Sustainability", "Heat Pumps & Direct Use"] },
    { label: "Helping people or volunteering", short: "helping people", weight: 1, clusters: ["Communications, Outreach & Education", "Environmental & Sustainability"] },
    { label: "Debating, student council or clubs", short: "debating and clubs", weight: 1, clusters: ["Policy & Law", "Leadership & Management"] },
    { label: "Selling things or running a small business", short: "running a business", weight: 1, clusters: ["Business & Commercial"] },
    { label: "Sports and team activities", short: "team sports", weight: 0.5, clusters: ["Leadership & Management", "Plant Operations & Maintenance"] }
  ];

  var SECTOR_CONTEXT = {
    careerStage: "Geothermal energy uses heat from inside the Earth to generate electricity and to heat and cool buildings. Delivering it takes scientists, engineers, tradespeople, analysts, lawyers and communicators.",
    region: "Geothermal projects operate across the Americas, Africa, Asia-Pacific and Europe. Next-generation approaches such as enhanced geothermal systems (EGS) and closed-loop designs aim to extend it far beyond traditional volcanic regions.",
    subjects: "Many skills transfer directly. Geothermal drilling and reservoir engineering draw heavily on oil & gas techniques, and plant operations draw on the wider power sector.",
    field: "Many skills transfer directly. Geothermal drilling and reservoir engineering draw heavily on oil & gas techniques, and plant operations draw on the wider power sector.",
    industry: "Many skills transfer directly. Geothermal drilling and reservoir engineering draw heavily on oil & gas techniques, and plant operations draw on the wider power sector.",
    scenario: "A geothermal project moves through stages: exploration, drilling, plant design and construction, then decades of operation. Each stage needs different people.",
    interests: "Geothermal power is firm, or 'baseload': it generates around the clock regardless of weather, which makes it a strong partner to solar and wind.",
    activities: "Not all geothermal is electricity. Direct use applies the heat itself to greenhouses, food drying, aquaculture and district heating, and ground-source heat pumps can heat and cool buildings almost anywhere.",
    environments: "Many geothermal careers mix settings. A geologist might spend weeks mapping in the field and months modelling in an office.",
    familiarity: "This question isn't scored. It helps Geothermal Rising understand how much people learn from GeoMatch."
  };

  var SECTOR_CONTEXT_MS = {
    careerStage: "Geothermal energy uses heat from inside the Earth to make electricity and to heat and cool buildings. All kinds of people help make it happen.",
    region: "Geothermal projects happen all over the world, from the Americas to Africa, Asia and Europe.",
    subjects: "The subjects you enjoy now can connect to real geothermal jobs later.",
    freeTime: "Lots of geothermal jobs connect to things you might already enjoy, like exploring outdoors, building things or working with computers.",
    scenario: "Building a geothermal power plant takes many steps and many kinds of jobs, from finding the heat to telling people about it.",
    environments: "Geothermal jobs happen in lots of different places — outdoors, in offices, in labs and at power plants.",
    familiarity: "This question isn't scored. It just helps Geothermal Rising understand how much people learn from GeoMatch."
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
  var ENTRY_ROUTE_LABELS_MS = {
    "Degree": "University degree",
    "Diploma": "College diploma",
    "Apprenticeship": "Apprenticeship",
    "Certification": "Industry certification",
    "Experience": "Degree, then work experience"
  };

  var WEIGHTS = { field: 6, industry: 6, interest: 4, activity: 3, environment: 2, scenario: 5 };

  /* ============================== "Why" sentence building (Section 7) ============================== */

  var REASON_PHRASE = {
    scenario: function (raws) { return "you want to " + joinAnd(raws); },
    interest: function (raws) { return "you're interested in " + joinAnd(raws); },
    activity: function (raws) { return "you enjoy " + joinAnd(raws.map(function (r) { return r.toLowerCase(); })); },
    environment: function (raws) { return "you'd like to work " + joinAnd(raws.map(function (r) { return ENV_PHRASES[r] || r; })); },
    subject: function (raws) { return "you like " + joinAnd(raws); },
    field: function (raws) { return "of your background in " + joinAnd(raws); },
    industry: function (raws) { return "of your experience in " + joinAnd(raws); },
    freeTime: function (raws) { return "you like " + joinAnd(raws); }
  };

  function groupReasons(items) {
    var order = [], groups = {};
    items.forEach(function (it) {
      if (!groups[it.type]) { groups[it.type] = []; order.push(it.type); }
      if (groups[it.type].indexOf(it.raw) === -1) groups[it.type].push(it.raw);
    });
    return order.map(function (type) { return { type: type, raws: groups[type] }; });
  }

  function sentenceFromGroups(groups) {
    if (!groups.length) return null;
    var phrases = groups.map(function (g) { return REASON_PHRASE[g.type](g.raws); });
    var leadIsBackground = groups[0].type === "field" || groups[0].type === "industry";
    var sentence;
    if (leadIsBackground) {
      var rest = phrases.slice(1);
      sentence = "Because " + phrases[0] + (rest.length ? ", " + joinAnd(rest) : "");
    } else {
      sentence = joinAnd(phrases);
    }
    sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
    if (!/[.!?]$/.test(sentence)) sentence += ".";
    return sentence;
  }

  function sentenceFromTopItems(items) {
    // items already capped (top 3 by points), each {type, raw}
    return sentenceFromGroups(groupReasons(items));
  }

  function sentenceFromAllItems(items) {
    // group first, then cap groups at 3
    return sentenceFromGroups(groupReasons(items).slice(0, 3));
  }

  function fieldReasonFor(fieldName) {
    if (state.careerStageGroup === "school") {
      var map = isMiddleSchool() ? MS_SUBJECT_FIELD_MAP : SUBJECT_FIELD_MAP;
      var subj = (state.answers.subjects || []).filter(function (s) { return (map[s] || []).indexOf(fieldName) > -1; })[0];
      return { type: "subject", raw: subj || fieldName };
    }
    return { type: "field", raw: fieldName };
  }

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
    interestAfter: null,
    lastStepReached: 0
  };

  function isMiddleSchool() { return state.answers.careerStage === "Middle School"; }

  function stageGroupFor(stageLabel) {
    var opt = STAGE_OPTIONS.filter(function (o) { return o.label === stageLabel; })[0];
    return opt ? opt.group : null;
  }

  /* ============================== Step list (dynamic) ============================== */

  function getStepList() {
    var stage = state.answers.careerStage;
    var group = stageGroupFor(stage);
    var step3id = group === "professional" ? "industry" : (group === "tertiary" ? "field" : "subjects");
    var list = ["careerStage", "region", step3id];
    if (isMiddleSchool()) {
      list.push("freeTime", "scenario", "environments", "familiarity");
    } else {
      list.push("scenario", "interests", "activities", "environments", "familiarity");
    }
    return list;
  }

  function totalSteps() { return getStepList().length; }

  function getSectorContext(id) {
    if (isMiddleSchool() && SECTOR_CONTEXT_MS[id]) return SECTOR_CONTEXT_MS[id];
    return SECTOR_CONTEXT[id] || "";
  }

  /* ============================== Step definitions ============================== */

  function getStepDefinitionById(id) {
    switch (id) {
      case "careerStage":
        return { id: "careerStage", title: "Where are you right now?", type: "single", options: STAGE_OPTIONS.map(function (o) { return { value: o.label, label: o.label, hint: o.hint }; }) };
      case "region":
        return { id: "region", title: "Where in the world are you?", type: "single", options: REGION_OPTIONS.map(function (l) { return { value: l, label: l }; }) };
      case "subjects":
        if (isMiddleSchool()) {
          return {
            id: "subjects", title: "Which subjects do you enjoy most?", type: "multi", max: 2,
            options: MS_SUBJECT_OPTIONS.map(function (l) { return { value: l, label: l, hint: MS_SUBJECT_HINTS[l] || "" }; })
          };
        }
        return { id: "subjects", title: "Which subjects do you enjoy or do best in?", type: "multi", max: 2, options: SUBJECT_OPTIONS.map(function (l) { return { value: l, label: l }; }) };
      case "field":
        return { id: "field", title: "What is your field of study?", type: "single", options: FIELD_OPTIONS.map(function (l) { return { value: l, label: l }; }) };
      case "industry":
        return {
          id: "industry", title: "Which industry or field are you coming from?", type: "single",
          options: INDUSTRY_OPTIONS.map(function (l) { return { value: l, label: l, hint: (l !== "Other" && TRANSITION_MAP[l]) ? "Strong transfer path" : "" }; })
        };
      case "freeTime":
        return { id: "freeTime", title: "What do you like doing in your free time?", type: "multi", max: 3, options: FREE_TIME_OPTIONS.map(function (o) { return { value: o.label, label: o.label }; }) };
      case "scenario":
        return {
          id: "scenario",
          title: isMiddleSchool() ? "A town is building a new geothermal power plant. Which jobs would you like to help with?" : "A new geothermal project is being developed. Which part would you most want to work on?",
          type: "multi", max: 2, wide: true,
          options: SCENARIO_OPTIONS.map(function (o) { return { value: o.id, label: isMiddleSchool() ? o.labelMS : o.label }; })
        };
      case "interests":
        return { id: "interests", title: "What are you interested in?", type: "multi", max: 5, options: INTEREST_OPTIONS.map(function (l) { return { value: l, label: l }; }) };
      case "activities":
        return { id: "activities", title: "Which kinds of work would you enjoy?", type: "multi", max: 5, options: ACTIVITY_OPTIONS.map(function (l) { return { value: l, label: l }; }) };
      case "environments": {
        var envList = isMiddleSchool() ? ENVIRONMENT_OPTIONS.filter(function (e) { return e !== "Government"; }) : ENVIRONMENT_OPTIONS;
        return {
          id: "environments", title: "Where would you like to work?", type: "multi", max: 3,
          options: envList.map(function (e) { return { value: e, label: isMiddleSchool() ? (ENVIRONMENT_MS_LABELS[e] || e) : e }; })
        };
      }
      case "familiarity":
        return { id: "familiarity", title: "Before today, how familiar were you with geothermal energy?", type: "single", notScored: true, options: FAMILIARITY_OPTIONS.map(function (l) { return { value: l, label: l }; }) };
      default:
        return null;
    }
  }

  /* ============================== Scoring engine ============================== */

  function getUserFields() {
    var group = state.careerStageGroup;
    if (group === "school") {
      var map = isMiddleSchool() ? MS_SUBJECT_FIELD_MAP : SUBJECT_FIELD_MAP;
      var fields = [];
      (state.answers.subjects || []).forEach(function (subject) {
        (map[subject] || []).forEach(function (f) { fields.push(f); });
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

    function addShare(type, tagType, tagValue, weight) {
      maxPossible += weight;
      CLUSTERS.forEach(function (cluster) {
        var share = (clusterProfiles[cluster.name][tagType] || {})[tagValue] || 0;
        if (share > 0) {
          var pts = weight * share;
          clusterScores[cluster.name] += pts;
          contributions[cluster.name].push({ type: type, raw: tagValue, points: pts });
        }
      });
    }

    // Field / subject (best single matching field — no double counting)
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
          var reason = fieldReasonFor(bestField);
          contributions[cluster.name].push({ type: reason.type, raw: reason.raw, points: pts });
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
          contributions[cluster.name].push({ type: "industry", raw: industry, points: pts });
        }
      });
    }

    // Scenario (multi, up to 2; total weight 5 split evenly across picks; flat to each listed cluster)
    var scenarioPicks = state.answers.scenario || [];
    if (scenarioPicks.length) {
      maxPossible += WEIGHTS.scenario;
      var perPick = WEIGHTS.scenario / scenarioPicks.length;
      scenarioPicks.forEach(function (scenarioId) {
        var opt = SCENARIO_OPTIONS.filter(function (o) { return o.id === scenarioId; })[0];
        if (!opt) return;
        opt.clusters.forEach(function (clusterName) {
          clusterScores[clusterName] += perPick;
          contributions[clusterName].push({ type: "scenario", raw: opt.short, points: perPick });
        });
      });
    }

    // Free time (Middle School only)
    (state.answers.freeTime || []).forEach(function (label) {
      var item = FREE_TIME_OPTIONS.filter(function (o) { return o.label === label; })[0];
      if (!item) return;
      var eff = 3 * item.weight;
      maxPossible += eff;
      item.clusters.forEach(function (clusterName) {
        clusterScores[clusterName] += eff;
        contributions[clusterName].push({ type: "freeTime", raw: item.short, points: eff });
      });
    });

    (state.answers.interests || []).forEach(function (i) { addShare("interest", "interests", i, WEIGHTS.interest); });
    (state.answers.activities || []).forEach(function (a) { addShare("activity", "activities", a, WEIGHTS.activity); });
    (state.answers.environments || []).forEach(function (e) { addShare("environment", "environments", e, WEIGHTS.environment); });

    return { clusterScores: clusterScores, contributions: contributions, maxPossible: maxPossible, userFields: userFields };
  }

  function fitPercent(clusterScore, maxPossible) {
    if (!maxPossible) return 0;
    return clamp(Math.round((clusterScore / maxPossible) * 100), 0, 99);
  }

  function rankCareers(scoring, limit) {
    limit = limit || 5;
    var careers = window.GEOMATCH_CAREERS || [];
    var clusterScores = scoring.clusterScores;
    var topClusterScore = 0;
    Object.keys(clusterScores).forEach(function (k) { if (clusterScores[k] > topClusterScore) topClusterScore = clusterScores[k]; });

    var industry = (state.careerStageGroup === "professional" && state.answers.industry !== "Other") ? state.answers.industry : null;
    var freeTimePicks = state.answers.freeTime || [];

    var scored = careers.map(function (career) {
      var clusterPts = clusterScores[career.category] || 0;
      var clusterTerm = topClusterScore > 0 ? (clusterPts / topClusterScore) * 10 : 0;
      var matchedInterests = overlap(state.answers.interests, career.interests);
      var matchedActivities = overlap(state.answers.activities, career.activities);
      var matchedEnvironments = overlap(state.answers.environments, career.environments);
      var matchedField = scoring.userFields.filter(function (f) { return (career.fields || []).indexOf(f) > -1; })[0] || null;
      var industryMatches = !!(industry && (career.industries_transferable_from || []).indexOf(industry) > -1);
      var matchedFreeTime = freeTimePicks.filter(function (label) {
        var item = FREE_TIME_OPTIONS.filter(function (o) { return o.label === label; })[0];
        return item && item.clusters.indexOf(career.category) > -1;
      }).map(function (label) {
        return FREE_TIME_OPTIONS.filter(function (o) { return o.label === label; })[0].short;
      });

      var score = clusterTerm
        + 2.5 * matchedInterests.length
        + 2 * matchedActivities.length
        + 1.2 * matchedEnvironments.length
        + (matchedField ? 3 : 0)
        + (industryMatches ? 4 : 0)
        + 2.5 * matchedFreeTime.length;

      return {
        career: career,
        score: score,
        matchedInterests: matchedInterests,
        matchedActivities: matchedActivities,
        matchedEnvironments: matchedEnvironments,
        matchedField: matchedField,
        industryMatches: industryMatches,
        matchedFreeTime: matchedFreeTime
      };
    });

    scored.sort(function (a, b) { return b.score - a.score; });

    var top = [], perCategory = {};
    for (var i = 0; i < scored.length && top.length < limit; i++) {
      var item = scored[i];
      var cat = item.career.category;
      perCategory[cat] = perCategory[cat] || 0;
      if (perCategory[cat] >= 2) continue;
      perCategory[cat]++;
      top.push(item);
    }
    return top;
  }

  function careerWhySentence(item) {
    var raws = [];
    item.matchedInterests.forEach(function (r) { raws.push({ type: "interest", raw: r }); });
    item.matchedActivities.forEach(function (r) { raws.push({ type: "activity", raw: r }); });
    item.matchedEnvironments.forEach(function (r) { raws.push({ type: "environment", raw: r }); });
    item.matchedFreeTime.forEach(function (r) { raws.push({ type: "freeTime", raw: r }); });
    if (item.matchedField) {
      var reason = fieldReasonFor(item.matchedField);
      raws.push({ type: reason.type, raw: reason.raw });
    }
    if (item.industryMatches) raws.push({ type: "industry", raw: state.answers.industry });
    return sentenceFromAllItems(raws);
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
    state.interestAfter = null;
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
    var stepList = getStepList();
    if (state.step > stepList.length) state.step = stepList.length;
    var id = stepList[state.step - 1];
    var def = getStepDefinitionById(id);
    var answer = state.answers[def.id];
    var total = stepList.length;

    var optionsHtml = def.options.map(function (opt) {
      return renderOptionButton(def, opt, answer);
    }).join("");

    var groupRole = def.type === "single" ? "radiogroup" : "group";

    $("screen-question").innerHTML =
      '<div class="question-wrap">' +
        '<div class="question-main">' +
          '<div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + state.step + '" aria-label="Step ' + state.step + ' of ' + total + '">' +
            '<div class="progress-fill" style="width:' + Math.round((state.step / total) * 100) + '%"></div>' +
          '</div>' +
          '<p class="step-label">Step ' + state.step + ' of ' + total + '</p>' +
          '<h2 class="question-title">' + esc(def.title) + '</h2>' +
          (def.type === "multi" ? '<p class="multi-hint">Choose up to ' + def.max + '.</p>' : '') +
          '<div class="option-list ' + (def.wide ? "option-list-wide" : "") + '" role="' + groupRole + '" aria-label="' + esc(def.title) + '">' + optionsHtml + '</div>' +
          '<div class="selection-message" id="selection-message" aria-live="polite"></div>' +
          '<div class="step-nav">' +
            '<button type="button" class="btn btn-secondary" id="back-btn" ' + (state.step === 1 ? "disabled" : "") + '>Back</button>' +
            '<button type="button" class="btn btn-primary" id="next-btn" disabled>' + (state.step === total ? "See my results" : "Next") + '</button>' +
          '</div>' +
        '</div>' +
        '<aside class="question-side">' +
          '<div class="side-card">' +
            '<p class="eyebrow-small">Sector context</p>' +
            '<p class="side-text">' + esc(getSectorContext(id)) + '</p>' +
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
    var selected = isMulti ? (answer || []).indexOf(opt.value) > -1 : answer === opt.value;
    var roleAttr = isMulti ? 'aria-pressed="' + selected + '"' : 'role="radio" aria-checked="' + selected + '"';
    return (
      '<button type="button" class="option-card' + (selected ? " selected" : "") + '" data-value="' + esc(opt.value) + '" ' + roleAttr + '>' +
        '<span class="option-label">' + esc(opt.label) + '</span>' +
        (opt.hint ? '<span class="option-hint">' + esc(opt.hint) + '</span>' : '') +
      '</button>'
    );
  }

  function scenarioSummaryDisplay() {
    return (state.answers.scenario || []).map(function (id) {
      var o = SCENARIO_OPTIONS.filter(function (x) { return x.id === id; })[0];
      return o ? (isMiddleSchool() ? o.labelMS : o.label) : id;
    }).join("; ");
  }

  function renderSummary() {
    var lines = [];
    var order = [
      ["careerStage", "Stage"], ["region", "Region"], ["subjects", "Subjects"], ["field", "Field"],
      ["industry", "Industry"], ["freeTime", "Free time"], ["scenario", "Scenario"], ["interests", "Interests"],
      ["activities", "Working style"], ["environments", "Environment"], ["familiarity", "Familiarity"]
    ];
    order.forEach(function (pair) {
      var key = pair[0], label = pair[1];
      var val = state.answers[key];
      if (val == null || (Array.isArray(val) && !val.length)) return;
      var display;
      if (key === "scenario") display = scenarioSummaryDisplay();
      else display = Array.isArray(val) ? val.join(", ") : val;
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
      if (def.id === "careerStage") {
        var prevStage = state.answers.careerStage;
        var prevGroup = stageGroupFor(prevStage);
        var prevMS = prevStage === "Middle School";
        var newGroup = stageGroupFor(value);
        var newMS = value === "Middle School";
        state.answers.careerStage = value;
        if (newGroup !== prevGroup || newMS !== prevMS) {
          delete state.answers.subjects;
          delete state.answers.field;
          delete state.answers.industry;
          delete state.answers.freeTime;
          delete state.answers.interests;
          delete state.answers.activities;
        }
        state.careerStageGroup = newGroup;
      } else {
        state.answers[def.id] = value;
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
    var stepList = getStepList();
    var id = stepList[state.step - 1];
    logEvent("step", { sessionId: state.sessionId, stepId: id, timestamp: Date.now() });
    state.lastStepReached = Math.max(state.lastStepReached, state.step);
    if (state.step < stepList.length) {
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
    var top = rankCareers(scoring, isMiddleSchool() ? 3 : 5);
    logEvent("complete", {
      sessionId: state.sessionId,
      stage: state.answers.careerStage || "",
      region: state.answers.region || "",
      background: state.answers.subjects ? state.answers.subjects.join("; ") : (state.answers.field || state.answers.industry || ""),
      scenario: (state.answers.scenario || []).join(" | "),
      cluster1: clusterNamesSorted[0] || "",
      cluster2: clusterNamesSorted[1] || "",
      cluster3: clusterNamesSorted[2] || "",
      topCareer: top[0] ? top[0].career.title : "",
      familiarity: state.answers.familiarity || "",
      interestAfter: "",
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
    var topCareers = rankCareers(scoring, isMiddleSchool() ? 3 : 5);

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
    html += renderInterestAfterCard();
    if (!isMiddleSchool()) html += renderSkillsSection(topCareers);
    html += renderTrainingSection(topCareers);
    html += renderNextStepsSection();
    html += '<footer class="disclaimer-footer">GeoMatch by Geothermal Rising &middot; Results are guidance, not a prediction. Explore widely.</footer>';

    $("screen-results").innerHTML = '<div class="results-wrap">' + html + '</div>';
    showScreen("screen-results");
    bindResultsEvents(shareUrl, topCluster, top3, topCareers, scoring);
  }

  function renderResultsHero(topCluster, shareUrl) {
    var showEmailBtn = !(isMiddleSchool() && !CONFIG.middleSchoolEmail);
    return (
      '<section class="results-hero">' +
        '<p class="eyebrow">Your geothermal pathway</p>' +
        '<h1 class="hero-title">' + esc(topCluster.name) + '</h1>' +
        '<p class="hero-desc">' + esc(topCluster.description) + '</p>' +
        '<div class="hero-actions">' +
          '<button type="button" class="btn btn-secondary" id="print-btn">Save as PDF</button>' +
          (showEmailBtn ? '<button type="button" class="btn btn-secondary" id="email-scroll-btn">Email my results</button>' : '') +
          '<button type="button" class="btn btn-secondary" id="copy-link-btn">Copy share link</button>' +
          '<button type="button" class="btn btn-secondary" id="start-over-btn">Start over</button>' +
        '</div>' +
      '</section>'
    );
  }

  function renderTopClustersSection(top3, maxPossible) {
    var cards = top3.map(function (cluster) {
      var pct = fitPercent(cluster.score, maxPossible);
      var topItems = cluster.contributions.slice().sort(function (a, b) { return b.points - a.points; }).slice(0, 3).map(function (c) { return { type: c.type, raw: c.raw }; });
      var sentence = sentenceFromTopItems(topItems);
      return (
        '<div class="cluster-card card-tick">' +
          '<h3 class="cluster-name">' + esc(cluster.name) + '</h3>' +
          '<div class="fit-row"><div class="fit-bar"><div class="fit-bar-fill" style="width:' + pct + '%"></div></div><span class="fit-pct">' + pct + '% fit</span></div>' +
          '<p class="cluster-desc">' + esc(cluster.description) + '</p>' +
          (sentence ? '<p class="cluster-reason"><strong>Why this fits you:</strong> ' + esc(sentence) + '</p>' : '') +
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
    var msEmailOff = isMiddleSchool() && !CONFIG.middleSchoolEmail;
    var heading = msEmailOff ? "Save your results" : "Take your results with you";

    if (msEmailOff) {
      return (
        '<section class="take-results-section card-tick">' +
          '<h2 class="section-title">' + heading + '</h2>' +
          '<p class="email-helper">Scan the QR code or print your results to show a parent or teacher.</p>' +
          '<div class="qr-panel">' +
            '<div id="qr-holder" class="qr-holder"></div>' +
            qrNote +
            '<p class="share-link-text" id="share-link-text">' + esc(shareUrl) + '</p>' +
          '</div>' +
        '</section>'
      );
    }

    return (
      '<section class="take-results-section card-tick">' +
        '<h2 class="section-title">' + heading + '</h2>' +
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
    var ranked = rankCareers(scoring, 5);
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
    var ms = isMiddleSchool();
    var entryLabels = ms ? ENTRY_ROUTE_LABELS_MS : ENTRY_ROUTE_LABELS;
    var cards = topCareers.map(function (item) {
      var career = item.career;
      var sentence = careerWhySentence(item);
      var tasksHtml = ms
        ? '<div><p class="eyebrow-small">What you\'d do</p><ul class="plain-list">' + career.typical_tasks.slice(0, 2).map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + '</ul></div>'
        : '<div><p class="eyebrow-small">Typical tasks</p><ul class="plain-list">' + career.typical_tasks.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + '</ul></div>';
      var detailGrid = ms
        ? '<div class="career-detail-grid">' + tasksHtml + '</div>'
        : '<div class="career-detail-grid">' + tasksHtml +
          '<div><p class="eyebrow-small">Key skills</p><ul class="plain-list">' + career.skills.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + '</ul></div>' +
          '<div><p class="eyebrow-small">Degrees &amp; training</p><ul class="plain-list">' + career.degrees.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + '</ul></div>' +
          '<div><p class="eyebrow-small">Useful courses</p><ul class="plain-list">' + career.courses.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + '</ul></div>' +
          '</div>';
      return (
        '<article class="career-card card-tick">' +
          '<div class="career-card-top">' +
            '<span class="tag tag-moss">' + esc(career.category) + '</span>' +
            '<span class="tag tag-outline">' + esc(entryLabels[career.entry_route] || career.entry_route) + '</span>' +
          '</div>' +
          '<h3 class="career-title">' + esc(career.title) + '</h3>' +
          '<p class="career-desc">' + esc(career.description) + '</p>' +
          (sentence ? '<p class="career-matches"><strong>Why it suits you:</strong> ' + esc(sentence) + '</p>' : "") +
          detailGrid +
        '</article>'
      );
    }).join("");
    var jobBoardHtml = (!ms && CONFIG.links.jobBoard)
      ? '<p class="job-board-link">' + extLink("jobBoard", "See current geothermal job openings →") + '</p>'
      : "";
    return (
      '<section class="careers-section">' +
        '<div class="section-header"><p class="eyebrow-small">Top matches</p><h2 class="section-title">Careers to explore</h2></div>' +
        '<div class="career-grid">' + cards + '</div>' +
        jobBoardHtml +
      '</section>'
    );
  }

  /* ============================== Interest after results (Section 8) ============================== */

  var INTEREST_AFTER_OPTIONS = ["Not really", "A little curious", "Very interested"];

  function renderInterestAfterCard() {
    var current = state.interestAfter;
    var btns = INTEREST_AFTER_OPTIONS.map(function (o) {
      var sel = current === o;
      return '<button type="button" class="btn btn-secondary interest-after-btn' + (sel ? " selected" : "") + '" data-value="' + esc(o) + '" aria-pressed="' + sel + '">' + esc(o) + '</button>';
    }).join("");
    return (
      '<section class="interest-after-card card-tick" id="interest-after-card">' +
        '<h3 class="interest-after-title">After seeing your results, how interested are you in a career in geothermal?</h3>' +
        '<div class="interest-after-buttons">' + btns + '</div>' +
        '<p class="interest-after-thanks" id="interest-after-thanks"' + (current ? "" : " hidden") + '>Thanks!</p>' +
      '</section>'
    );
  }

  function recordInterestAfter(value) {
    state.interestAfter = value;
    if (state.isRestoredView) return;
    try {
      var events = safeLocalStorageGet("geomatch_events", []);
      events.forEach(function (e) { if (e.type === "complete" && e.sessionId === state.sessionId) e.interestAfter = value; });
      safeLocalStorageSet("geomatch_events", events);
    } catch (e) { /* ignore */ }
    logEvent("interest_after", { sid: state.sessionId, value: value, t: Date.now() });
  }

  /* ============================== Links (Section 9) ============================== */

  function extLink(key, text) {
    var url = CONFIG.links[key];
    if (!url) return "";
    return '<a href="' + esc(url) + '" target="_blank" rel="noopener" class="ext-link" data-link-key="' + esc(key) + '">' + esc(text) + '</a>';
  }

  function trackLinkClick(key) {
    logEvent("link_click", { which: key, sid: state.sessionId, t: Date.now() });
  }

  function connectLineHtml() {
    var g = CONFIG.links.geothermalRising ? extLink("geothermalRising", "Geothermal Rising") : "Geothermal Rising";
    var e = CONFIG.links.events ? extLink("events", "upcoming events") : "upcoming events";
    return "Connect with " + g + " and see " + e + ".";
  }

  function connectLineText() {
    return "- Connect with Geothermal Rising" + (CONFIG.links.geothermalRising ? " (" + CONFIG.links.geothermalRising + ")" : "") +
      " and see upcoming events" + (CONFIG.links.events ? " (" + CONFIG.links.events + ")" : "") + ".";
  }

  function getNextStepsItems() {
    var group = state.careerStageGroup;
    var items = [];
    if (isMiddleSchool()) {
      var subj = (state.answers.subjects || []).slice(0, 2);
      items.push({ text: "Keep going with " + (subj.length ? joinAnd(subj) : "your favourite subjects") + " at school." });
      items.push({ text: "Try something hands-on: a science fair, coding club, nature trip or building project." });
      items.push({ text: "Ask a teacher or family member to help you learn more about energy careers." });
      if (CONFIG.links.learn) items.push({ text: "Learn more about geothermal energy", linkKey: "learn" });
    } else if (group === "school") {
      items.push({ text: "Keep up the subjects that lead to your matched fields." });
      items.push({ text: "Look for science fairs, field trips, coding clubs and job shadowing." });
      items.push({ text: "Ask a teacher or counsellor about programs in these areas." });
      if (CONFIG.links.studentResources) items.push({ text: "Explore student resources", linkKey: "studentResources" });
      if (CONFIG.links.studentCommittee) items.push({ text: "Join the Geothermal Rising Student Committee", linkKey: "studentCommittee" });
    } else if (group === "tertiary") {
      items.push({ text: "Add a specific course from your matched list to your next term." });
      items.push({ text: "Look for internships, field schools and research projects." });
      items.push({ text: "Build a portfolio piece related to your top matched career." });
      items.push({ text: "Attend a conference or webinar — many offer student rates." });
      if (CONFIG.links.jobBoard) items.push({ text: "Browse the Geothermal Rising job board", linkKey: "jobBoard" });
      if (CONFIG.links.studentResources) items.push({ text: "Explore student resources", linkKey: "studentResources" });
      if (CONFIG.links.studentCommittee) items.push({ text: "Join the Geothermal Rising Student Committee", linkKey: "studentCommittee" });
      if (CONFIG.links.membership) items.push({ text: "Become a Geothermal Rising member", linkKey: "membership" });
    } else {
      items.push({ text: "Rewrite your CV in geothermal terms using your transferable skills." });
      items.push({ text: "Take short training in the courses listed for your top matches." });
      items.push({ text: "Explore roles like your top match on geothermal job boards and professional networks." });
      if (CONFIG.links.jobBoard) items.push({ text: "Browse the Geothermal Rising job board", linkKey: "jobBoard" });
      if (CONFIG.links.membership) items.push({ text: "Become a Geothermal Rising member", linkKey: "membership" });
    }
    return items;
  }

  function nextStepsHtml() {
    var items = getNextStepsItems();
    var lis = items.map(function (it) {
      return "<li>" + (it.linkKey ? extLink(it.linkKey, it.text) : esc(it.text)) + "</li>";
    });
    lis.push("<li>" + connectLineHtml() + "</li>");
    return lis.join("");
  }

  function nextStepsPlainTextLines() {
    var items = getNextStepsItems();
    var lines = items.map(function (it) {
      if (it.linkKey && CONFIG.links[it.linkKey]) return "- " + it.text + ": " + CONFIG.links[it.linkKey];
      return "- " + it.text;
    });
    lines.push(connectLineText());
    return lines;
  }

  /* ============================== Skills / training / next steps ============================== */

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
    var ms = isMiddleSchool();
    var careers = topCareers.map(function (t) { return t.career; });
    var fields = uniq([].concat.apply([], careers.map(function (c) { return c.fields || []; })));

    if (group === "school") {
      var subjectOptions = ms ? MS_SUBJECT_OPTIONS : SUBJECT_OPTIONS;
      var subjectMap = ms ? MS_SUBJECT_FIELD_MAP : SUBJECT_FIELD_MAP;
      var subjects = subjectOptions.filter(function (subject) {
        return subjectMap[subject].some(function (f) { return fields.indexOf(f) > -1; });
      });
      var entryLabels = ms ? ENTRY_ROUTE_LABELS_MS : ENTRY_ROUTE_LABELS;
      var entryRoutes = uniq(careers.map(function (c) { return c.entry_route; })).map(function (r) { return entryLabels[r] || r; });
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
    return (
      '<section class="next-steps-section card-tick">' +
        '<h2 class="section-title">Next steps</h2>' +
        '<ul class="plain-list next-steps-list">' + nextStepsHtml() + '</ul>' +
      '</section>'
    );
  }

  /* ============================== Results interactions ============================== */

  function bindResultsEvents(shareUrl, topCluster, top3, topCareers, scoring) {
    renderQrCode(shareUrl);

    $("print-btn").addEventListener("click", function () { window.print(); });
    var emailScrollBtn = $("email-scroll-btn");
    if (emailScrollBtn) emailScrollBtn.addEventListener("click", function () {
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

    Array.prototype.slice.call(document.querySelectorAll(".interest-after-btn")).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var value = btn.getAttribute("data-value");
        recordInterestAfter(value);
        Array.prototype.slice.call(document.querySelectorAll(".interest-after-btn")).forEach(function (b) {
          var isSel = b === btn;
          b.classList.toggle("selected", isSel);
          b.setAttribute("aria-pressed", String(isSel));
        });
        var thanks = $("interest-after-thanks");
        if (thanks) thanks.hidden = false;
      });
    });

    Array.prototype.slice.call(document.querySelectorAll("#screen-results .ext-link")).forEach(function (a) {
      a.addEventListener("click", function () { trackLinkClick(a.getAttribute("data-link-key")); });
    });
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
      var entryLabels = isMiddleSchool() ? ENTRY_ROUTE_LABELS_MS : ENTRY_ROUTE_LABELS;
      return "- " + item.career.title + " (" + (entryLabels[item.career.entry_route] || item.career.entry_route) + "): " + item.career.description;
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
    var nextSteps = nextStepsPlainTextLines();

    var text =
      "Here are your GeoMatch geothermal career results.\n\n" +
      "Top clusters:\n" + clusterLines + "\n\n" +
      "Top careers:\n" + careerLines + "\n\n" +
      (isMiddleSchool() ? "" : "Skills to develop:\n" + skills.map(function (s) { return "- " + s; }).join("\n") + "\n\n") +
      (state.careerStageGroup === "school" ? "What to study next:\n" : "Degrees and training:\n") + studyLines + "\n\n" +
      "Next steps:\n" + nextSteps.join("\n") + "\n\n" +
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
      '<h2>Top careers</h2><ul>' + topCareers.map(function (item) {
        var entryLabels = isMiddleSchool() ? ENTRY_ROUTE_LABELS_MS : ENTRY_ROUTE_LABELS;
        return "<li><strong>" + esc(item.career.title) + "</strong> (" + esc(entryLabels[item.career.entry_route] || item.career.entry_route) + "): " + esc(item.career.description) + "</li>";
      }).join("") + '</ul>' +
      (isMiddleSchool() ? "" : '<h2>Skills to develop</h2><ul>' + skills.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + '</ul>') +
      '<h2>Next steps</h2><ul>' + nextStepsHtml() + '</ul>' +
      '<p style="text-align:center;margin:24px 0;">' +
      '<a href="' + esc(shareUrl) + '" style="background:#FDC40F;color:#000;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;display:inline-block;">Reopen your full results</a>' +
      '</p>' +
      '<p style="font-size:12px;color:#555;">GeoMatch by Geothermal Rising. Results are guidance, not a prediction. You received this because you requested it at GeoMatch. No further emails will be sent.</p>' +
      '</div>';

    return { subject: subject, text: text, textShort: textShort, html: html };
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
      sessionId: state.sessionId,
      interestAfter: state.interestAfter || ""
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

    if (CONFIG.analyticsEndpoint && (type === "complete" || type === "link_click" || type === "interest_after")) {
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

    var interestAnswered = completes.filter(function (c) { return c.interestAfter; });
    var interestRows = tally(interestAnswered, "interestAfter");
    var responseRate = completes.length ? Math.round((interestAnswered.length / completes.length) * 100) : 0;
    var familiarityVals = uniq(completes.map(function (c) { return c.familiarity || "(blank)"; }));
    var crossTableHtml = '<div class="admin-table-card"><h3>Prior familiarity &times; interest after results</h3>' +
      '<table class="admin-table"><thead><tr><th></th>' + INTEREST_AFTER_OPTIONS.map(function (v) { return "<th>" + esc(v) + "</th>"; }).join("") + '</tr></thead><tbody>' +
      familiarityVals.map(function (fv) {
        return "<tr><td>" + esc(fv) + "</td>" + INTEREST_AFTER_OPTIONS.map(function (iv) {
          var count = completes.filter(function (c) { return (c.familiarity || "(blank)") === fv && c.interestAfter === iv; }).length;
          return "<td>" + count + "</td>";
        }).join("") + "</tr>";
      }).join("") + '</tbody></table></div>';

    var linkClicks = events.filter(function (e) { return e.type === "link_click"; });
    var linkClickRows = tally(linkClicks, "which");

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
          '<h2>Interest after results</h2>' +
          '<div class="admin-stat-row">' +
            '<div class="stat"><div class="stat-num">' + responseRate + '%</div><div class="stat-label">Response rate</div></div>' +
          '</div>' +
          '<div class="admin-table-grid">' + tableHtml("Interest after results", interestRows) + crossTableHtml + '</div>' +
        '</div>' +
        '<div class="admin-email-panel">' +
          '<h2>Link clicks</h2>' +
          '<div class="admin-table-grid">' + tableHtml("Clicks by link", linkClickRows) + '</div>' +
        '</div>' +
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
    $("download-csv-btn").addEventListener("click", function () { downloadCsv(completes, ["sessionId", "stage", "region", "background", "scenario", "cluster1", "cluster2", "cluster3", "topCareer", "familiarity", "interestAfter", "timestamp"], "geomatch_completions.csv"); });
    $("download-email-csv-btn").addEventListener("click", function () { downloadCsv(emails, ["timestamp", "email", "method", "stage", "region", "background", "cluster1", "cluster2", "cluster3", "career1", "familiarity", "followUp", "guardianConsent", "interestAfter", "sessionId"], "geomatch_emails.csv"); });
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
        if (typeof answers.scenario === "string") {
          var legacyOpt = SCENARIO_OPTIONS.filter(function (o) { return o.label === answers.scenario; })[0];
          answers.scenario = legacyOpt ? [legacyOpt.id] : [];
        }
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
