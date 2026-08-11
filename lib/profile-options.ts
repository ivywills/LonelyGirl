/*
 * Profile option lists. Only the `id`s are persisted, so labels and emoji can
 * be edited freely without a migration — never renumber or reuse an existing
 * id, that silently rewrites what people already said about themselves.
 *
 * Every list is a starter set, not a finished one. Keep adding as real users
 * ask for their area / field / interest.
 */

export type Option = { id: string; emoji: string; label: string };
export type City = { id: string; label: string; neighborhoods: string[] };

/*
 * City -> neighborhoods, so Vancouver/Calgary/etc. can be appended later
 * without reshaping anything that reads from this. Don't flatten it back into
 * a single array.
 */
export const CITIES: City[] = [
  {
    id: "toronto",
    label: "Toronto",
    neighborhoods: [
      // Downtown & west
      "The Annex", "Kensington Market", "Chinatown", "Baldwin Village", "Alexandra Park",
      "Queen West", "King West", "Fashion District", "Entertainment District",
      "Financial District", "Garden District", "Yonge-Dundas", "St. Lawrence",
      "Distillery District", "Corktown", "Cabbagetown", "Regent Park", "Moss Park",
      "Church-Wellesley", "Yorkville", "CityPlace", "Harbourfront", "Fort York",
      "Liberty Village", "Niagara", "Trinity Bellwoods", "Little Italy", "Little Portugal",
      "Palmerston", "Harbord Village", "Seaton Village", "Christie Pits", "Dufferin Grove",
      "Brockton Village", "Dovercourt Park", "Bloordale", "Parkdale", "Roncesvalles",
      "High Park", "Swansea", "The Junction", "Junction Triangle", "Carleton Village",
      "Davenport", "Wychwood", "Humewood", "Casa Loma", "Corso Italia", "Earlscourt",
      "Oakwood Village", "Fairbank", "Silverthorn", "Mount Dennis", "Weston",
      "Bloor West Village", "Baby Point", "Lambton", "Old Mill", "Runnymede",
      // East
      "Riverdale", "Riverside", "Leslieville", "The Pocket", "Blake-Jones",
      "Playter Estates", "Greektown", "Danforth Village", "Pape Village", "East Danforth",
      "Little India", "The Beaches", "Upper Beaches", "East York", "Leaside",
      "Thorncliffe Park", "Flemingdon Park", "O'Connor-Parkview", "Victoria Village",
      // Midtown & north
      "Summerhill", "Rosedale", "Moore Park", "Deer Park", "Yonge-St. Clair",
      "Forest Hill", "South Hill", "Davisville Village", "Yonge and Eglinton",
      "Briar Hill", "Lawrence Park", "Bedford Park", "Lytton Park", "Teddington Park",
      "Hoggs Hollow", "York Mills", "Don Mills", "Banbury", "Parkwoods", "Henry Farm",
      "Bayview Village", "Willowdale", "Newtonbrook", "Bathurst Manor", "Downsview",
      "North York", "York University Heights", "Jane and Finch", "Maple Leaf",
      // Etobicoke
      "Etobicoke", "Mimico", "Humber Bay Shores", "New Toronto", "Long Branch",
      "Alderwood", "Islington Village", "The Kingsway", "Princess Gardens",
      "Markland Wood", "Eatonville", "Richview", "Centennial Park", "Rexdale",
      // Scarborough
      "Scarborough", "Birch Cliff", "Cliffside", "Guildwood", "West Hill", "Woburn",
      "Bendale", "Wexford", "Golden Mile", "Agincourt", "Milliken", "Malvern", "Rouge",
    ],
  },
];

export const AGE_RANGES = ["18–24", "25–29", "30–34", "35–39", "40–49", "50+"] as const;

export const JOBS: Option[] = [
  { id: "student", emoji: "🎓", label: "Student" },
  { id: "tech", emoji: "💻", label: "Tech" },
  { id: "health", emoji: "🏥", label: "Healthcare" },
  { id: "creative", emoji: "🎨", label: "Creative & arts" },
  { id: "education", emoji: "📚", label: "Education" },
  { id: "finance", emoji: "💰", label: "Finance & business" },
  { id: "hospitality", emoji: "🍽️", label: "Hospitality" },
  { id: "legal", emoji: "⚖️", label: "Legal" },
  { id: "trades", emoji: "🏗️", label: "Trades" },
  { id: "science", emoji: "🔬", label: "Science & research" },
  { id: "nonprofit", emoji: "🏛️", label: "Public & non-profit" },
  { id: "retail", emoji: "🛒", label: "Retail" },
  { id: "marketing", emoji: "📣", label: "Marketing & media" },
  { id: "government", emoji: "🏢", label: "Government" },
  { id: "realestate", emoji: "🏡", label: "Real estate" },
  { id: "beauty", emoji: "💅", label: "Beauty & wellness" },
  { id: "engineering", emoji: "⚙️", label: "Engineering" },
  { id: "admin", emoji: "📋", label: "Admin & customer service" },
  { id: "freelance", emoji: "🧑‍💻", label: "Freelance / self-employed" },
  { id: "caregiving", emoji: "🍼", label: "Caregiving" },
  { id: "socialwork", emoji: "🤲", label: "Social work" },
  { id: "therapy", emoji: "🛋️", label: "Therapy & counselling" },
  { id: "design", emoji: "✏️", label: "Design" },
  { id: "product", emoji: "🧭", label: "Product" },
  { id: "data", emoji: "📊", label: "Data & analytics" },
  { id: "sales", emoji: "🤝", label: "Sales" },
  { id: "hr", emoji: "👥", label: "HR & recruiting" },
  { id: "consulting", emoji: "📈", label: "Consulting" },
  { id: "insurance", emoji: "🛡️", label: "Insurance" },
  { id: "logistics", emoji: "🚚", label: "Transport & logistics" },
  { id: "manufacturing", emoji: "🏭", label: "Manufacturing" },
  { id: "architecture", emoji: "📐", label: "Architecture" },
  { id: "environment", emoji: "🌎", label: "Environment & sustainability" },
  { id: "vet", emoji: "🐕", label: "Veterinary & animals" },
  { id: "emergency", emoji: "🚑", label: "Emergency services" },
  { id: "aviation", emoji: "✈️", label: "Aviation & travel" },
  { id: "sport", emoji: "🏅", label: "Sport & fitness" },
  { id: "childcare", emoji: "🧸", label: "Childcare & early years" },
  { id: "agriculture", emoji: "🌾", label: "Agriculture & food" },
  { id: "between", emoji: "🔍", label: "Between jobs" },
  { id: "other", emoji: "✨", label: "Something else" },
];

export const HOBBIES: Option[] = [
  { id: "reading", emoji: "📚", label: "Reading" },
  { id: "art", emoji: "🎨", label: "Art" },
  { id: "gaming", emoji: "🎮", label: "Gaming" },
  { id: "crafting", emoji: "🧶", label: "Crafting" },
  { id: "photography", emoji: "📷", label: "Photography" },
  { id: "journaling", emoji: "✍️", label: "Journaling" },
  { id: "plants", emoji: "🌱", label: "Plants" },
  { id: "cooking", emoji: "🍳", label: "Cooking" },
  { id: "baking", emoji: "🍰", label: "Baking" },
  { id: "music", emoji: "🎵", label: "Music" },
  { id: "movies", emoji: "🎬", label: "Movies & TV" },
  { id: "dancing", emoji: "💃", label: "Dancing" },
  { id: "travel", emoji: "✈️", label: "Travel" },
  { id: "boardgames", emoji: "♟️", label: "Board games" },
  { id: "karaoke", emoji: "🎤", label: "Karaoke" },
  { id: "thrifting", emoji: "🛍️", label: "Thrifting" },
  { id: "wine", emoji: "🍷", label: "Wine nights" },
  { id: "coffee", emoji: "☕", label: "Coffee" },
  { id: "pets", emoji: "🐾", label: "Pets" },
  { id: "astrology", emoji: "✨", label: "Astrology" },
  { id: "sewing", emoji: "🧵", label: "Sewing" },
  { id: "podcasts", emoji: "🎧", label: "Podcasts" },
  { id: "museums", emoji: "🖼️", label: "Museums & galleries" },
  { id: "theatre", emoji: "🎭", label: "Theatre" },
  { id: "puzzles", emoji: "🧩", label: "Puzzles" },
  { id: "farmersmarkets", emoji: "🥕", label: "Farmers markets" },
  { id: "bowling", emoji: "🎳", label: "Bowling" },
  { id: "volunteering", emoji: "🤝", label: "Volunteering" },
  { id: "languages", emoji: "🗣️", label: "Language learning" },
  { id: "concerts", emoji: "🎶", label: "Concerts" },
  { id: "writing", emoji: "📝", label: "Writing" },
  { id: "poetry", emoji: "🕯️", label: "Poetry" },
  { id: "pottery", emoji: "🏺", label: "Pottery" },
  { id: "painting", emoji: "🖌️", label: "Painting" },
  { id: "knitting", emoji: "🧦", label: "Knitting" },
  { id: "embroidery", emoji: "🪡", label: "Embroidery" },
  { id: "jewellery", emoji: "💍", label: "Jewellery making" },
  { id: "candles", emoji: "🕯️", label: "Candle making" },
  { id: "calligraphy", emoji: "🖋️", label: "Calligraphy" },
  { id: "scrapbooking", emoji: "📔", label: "Scrapbooking" },
  { id: "vinyl", emoji: "💿", label: "Vinyl records" },
  { id: "anime", emoji: "🌸", label: "Anime" },
  { id: "kpop", emoji: "🩷", label: "K-pop" },
  { id: "comics", emoji: "💥", label: "Comics" },
  { id: "trivia", emoji: "🧠", label: "Trivia nights" },
  { id: "comedy", emoji: "🎙️", label: "Stand-up comedy" },
  { id: "brunch", emoji: "🥞", label: "Brunch" },
  { id: "cocktails", emoji: "🍸", label: "Cocktails" },
  { id: "craftbeer", emoji: "🍺", label: "Craft beer" },
  { id: "tea", emoji: "🍵", label: "Tea" },
  { id: "camping", emoji: "🏕️", label: "Camping" },
  { id: "birdwatching", emoji: "🐦", label: "Birdwatching" },
  { id: "gardening", emoji: "🌻", label: "Gardening" },
  { id: "skating", emoji: "⛸️", label: "Skating" },
  { id: "fashion", emoji: "👗", label: "Fashion" },
  { id: "makeup", emoji: "💄", label: "Makeup" },
  { id: "nailart", emoji: "💅", label: "Nail art" },
  { id: "interiors", emoji: "🛋️", label: "Interior design" },
  { id: "diy", emoji: "🔨", label: "DIY & home projects" },
  { id: "coding", emoji: "⌨️", label: "Coding" },
  { id: "investing", emoji: "📈", label: "Investing" },
  { id: "meditation", emoji: "🧘", label: "Meditation" },
  { id: "tarot", emoji: "🔮", label: "Tarot" },
  { id: "videoediting", emoji: "🎞️", label: "Video editing" },
  { id: "roadtrips", emoji: "🚗", label: "Road trips" },
];

export const FITNESS: Option[] = [
  { id: "running", emoji: "🏃‍♀️", label: "Running" },
  { id: "yoga", emoji: "🧘‍♀️", label: "Yoga" },
  { id: "pilates", emoji: "🤸‍♀️", label: "Pilates" },
  { id: "weights", emoji: "🏋️‍♀️", label: "Weights" },
  { id: "cycling", emoji: "🚴‍♀️", label: "Cycling" },
  { id: "swimming", emoji: "🏊‍♀️", label: "Swimming" },
  { id: "boxing", emoji: "🥊", label: "Boxing" },
  { id: "climbing", emoji: "🧗‍♀️", label: "Climbing" },
  { id: "hiking", emoji: "🥾", label: "Hiking" },
  { id: "team", emoji: "⚽", label: "Team sports" },
  { id: "walking", emoji: "🚶‍♀️", label: "Walking" },
  { id: "barre", emoji: "🩰", label: "Barre" },
  { id: "martialarts", emoji: "🥋", label: "Martial arts" },
  { id: "tennis", emoji: "🎾", label: "Tennis" },
  { id: "golf", emoji: "⛳", label: "Golf" },
  { id: "rowing", emoji: "🚣‍♀️", label: "Rowing" },
  { id: "spin", emoji: "🚲", label: "Spin" },
  { id: "hiit", emoji: "⚡", label: "HIIT" },
  { id: "crossfit", emoji: "🏋️", label: "CrossFit" },
  { id: "calisthenics", emoji: "🤾‍♀️", label: "Calisthenics" },
  { id: "aerial", emoji: "🎪", label: "Aerial & pole" },
  { id: "zumba", emoji: "🕺", label: "Dance fitness" },
  { id: "aquafit", emoji: "🌊", label: "Aquafit" },
  { id: "skiing", emoji: "🎿", label: "Skiing & snowboarding" },
  { id: "iceskating", emoji: "⛸️", label: "Ice skating" },
  { id: "volleyball", emoji: "🏐", label: "Volleyball" },
  { id: "basketball", emoji: "🏀", label: "Basketball" },
  { id: "badminton", emoji: "🏸", label: "Badminton" },
  { id: "squash", emoji: "🎯", label: "Squash" },
  { id: "tabletennis", emoji: "🏓", label: "Table tennis" },
  { id: "ultimate", emoji: "🥏", label: "Ultimate frisbee" },
  { id: "softball", emoji: "🥎", label: "Softball" },
  { id: "curling", emoji: "🥌", label: "Curling" },
  { id: "kayaking", emoji: "🛶", label: "Kayaking & paddling" },
  { id: "skateboarding", emoji: "🛹", label: "Skateboarding" },
  { id: "rollerskating", emoji: "🛼", label: "Roller skating" },
  { id: "mobility", emoji: "🪢", label: "Stretching & mobility" },
  { id: "easy", emoji: "🌙", label: "Taking it easy" },
];

/*
 * "Going through" — the gentlest list in the app. Keep every option short and
 * non-clinical, and keep the step skippable no matter how long this gets.
 * Stored in profile_private, never shown on a public profile card.
 */
export const STRUGGLES: Option[] = [
  { id: "anxiety", emoji: "😮‍💨", label: "Anxiety" },
  { id: "lonely", emoji: "🫂", label: "Loneliness" },
  { id: "burnout", emoji: "🔥", label: "Burnout" },
  { id: "heartbreak", emoji: "💔", label: "Heartbreak" },
  { id: "grief", emoji: "🕊️", label: "Grief" },
  { id: "injury", emoji: "🩹", label: "Recovering from an injury" },
  { id: "betweenjobs", emoji: "💼", label: "Between jobs" },
  { id: "newcity", emoji: "📦", label: "New to the city" },
  { id: "bigchange", emoji: "🌊", label: "A big life change" },
  { id: "hardseason", emoji: "🌤️", label: "Just a hard season" },
  { id: "depression", emoji: "🌧️", label: "Depression" },
  { id: "bodyimage", emoji: "🪞", label: "Body image" },
  { id: "chronicillness", emoji: "🎗️", label: "Chronic illness" },
  { id: "familystuff", emoji: "🏠", label: "Family stuff" },
  { id: "financial", emoji: "💸", label: "Financial stress" },
  { id: "careerchange", emoji: "🧭", label: "Career change" },
  { id: "socialanxiety", emoji: "🙈", label: "Social anxiety" },
  { id: "imposter", emoji: "🎭", label: "Imposter feelings" },
  { id: "perfectionism", emoji: "📏", label: "Perfectionism" },
  { id: "homesick", emoji: "🧳", label: "Homesickness" },
  { id: "friendshifts", emoji: "🌱", label: "Friendships shifting" },
  { id: "breakup", emoji: "🍂", label: "A breakup or divorce" },
  { id: "postgrad", emoji: "🎓", label: "Post-grad limbo" },
  { id: "newmom", emoji: "🍼", label: "New motherhood" },
  { id: "fertility", emoji: "🌙", label: "Fertility journey" },
  { id: "caregiver", emoji: "💗", label: "Caring for someone" },
  { id: "sobriety", emoji: "🌿", label: "Sobriety journey" },
  { id: "comingout", emoji: "🏳️‍🌈", label: "Coming out" },
  { id: "healthscare", emoji: "🩺", label: "A health scare" },
  { id: "startingtherapy", emoji: "🛋️", label: "Starting therapy" },
];

export const AVATAR_COLORS = [
  "#ffdf8e", "#a9d4ec", "#f4b6d0", "#c3ddb0",
  "#d3c5ef", "#f7c9a3", "#b7e4d6", "#b9c6f0",
] as const;

/* Lookup helpers — ids are what's stored, labels are what's shown. */
const byId = (list: Option[]) => new Map(list.map((o) => [o.id, o]));
export const JOBS_BY_ID = byId(JOBS);
export const HOBBIES_BY_ID = byId(HOBBIES);
export const FITNESS_BY_ID = byId(FITNESS);
export const STRUGGLES_BY_ID = byId(STRUGGLES);

/** Resolve stored ids to options, dropping any id that's since been removed. */
export function resolve(ids: string[], map: Map<string, Option>): Option[] {
  return ids.map((id) => map.get(id)).filter((o): o is Option => Boolean(o));
}

export function cityById(id: string): City {
  return CITIES.find((c) => c.id === id) ?? CITIES[0];
}
