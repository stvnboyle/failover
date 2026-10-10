import type { Lesson } from "@/content/schema";

// DRAFT — awaiting review. Written from the AWS Regions and Availability Zones guide and the
// fault isolation boundaries whitepaper; every exercise links the page it rests on.

const REGIONS = {
  title: "AWS Regions",
  url: "https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions.html",
};
const ZONES = {
  title: "AWS Availability Zones",
  url: "https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-availability-zones.html",
};
const ISOLATION_REGIONS = {
  title: "AWS fault isolation boundaries: Regions",
  url: "https://docs.aws.amazon.com/whitepapers/latest/aws-fault-isolation-boundaries/regions.html",
};
const ISOLATION_ZONES = {
  title: "AWS fault isolation boundaries: Availability Zones",
  url: "https://docs.aws.amazon.com/whitepapers/latest/aws-fault-isolation-boundaries/availability-zones.html",
};
const SUBNETS = {
  title: "Subnets for your VPC",
  url: "https://docs.aws.amazon.com/vpc/latest/userguide/configure-subnets.html",
};
const S3_WELCOME = {
  title: "What is Amazon S3?",
  url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html",
};

export const regions: Lesson = {
  id: "regions",
  title: "Regions and Availability Zones",
  summary: "Where AWS physically is, and why one data centre failing needn't take you down.",
  steps: [
    {
      type: "card",
      id: "card-regions",
      concept: "regions",
      title: "AWS is split into Regions",
      body: "A Region is a geographic area that AWS runs data centres in, and each Region is isolated from the others. What you create in one Region stays there unless you copy it somewhere else yourself.",
      diagram: [
        { id: "london", icon: "region", label: "eu-west-2", tag: "Europe (London)", holds: ["web server", "database", "my-site bucket"] },
      ],
    },
    {
      type: "choice",
      id: "resource-stays-put",
      concept: "regions",
      prompt: "You launch a server in the London Region. A colleague opens the Ireland Region and can't see it anywhere. Why?",
      options: [
        { id: "local", text: "It only exists in the Region where it was created", correct: true, why: "Resources belong to one Region. Looking in another Region shows that Region's resources, not yours." },
        { id: "lag", text: "New servers take a few hours to appear in other Regions", why: "They never appear. Nothing is copied to another Region unless you copy it." },
        { id: "perms", text: "Your colleague lacks permission to see it", why: "Permissions aren't the issue. The server simply isn't in Ireland." },
        { id: "hidden", text: "Servers are hidden from other Regions until they pass a health check", why: "There's no such step. A server is in one Region and stays there." },
      ],
      explanation: "This isolation is deliberate: a problem in one Region stays in that Region, and the others carry on unaffected.",
      source: ISOLATION_REGIONS,
      domains: ["clf-3", "saa-2"],
      pillars: ["reliability"],
    },
    {
      type: "choice",
      id: "choosing-a-region",
      concept: "regions",
      prompt: "Most of your users are in Germany, and the law says their data must stay inside the EU. Which Region do you build in?",
      options: [
        { id: "frankfurt", text: "Europe (Frankfurt)", correct: true, why: "It is close to the users, which keeps latency low, and it keeps the data in the EU." },
        { id: "virginia", text: "US East (N. Virginia), because it is the largest", why: "Size doesn't help here. It is far from the users and outside the EU." },
        { id: "cheapest", text: "Whichever Region is cheapest this month", why: "Cost matters, but not ahead of a legal requirement about where the data lives." },
        { id: "any", text: "Any Region, since AWS moves data closer to users automatically", why: "AWS doesn't move your data between Regions. Where you build is where it stays." },
      ],
      explanation: "A Region is chosen for being near your users, for meeting legal requirements, and for having the services you need.",
      source: REGIONS,
      domains: ["clf-3", "saa-3"],
      pillars: ["performance-efficiency"],
    },
    {
      type: "match",
      id: "region-factors",
      concept: "regions",
      prompt: "Match each situation to the way it should shape your choice of Region.",
      pairs: [
        { left: "Pages load slowly for users far away", right: "Choose a Region close to most of your users", why: "A shorter distance to the Region means lower network latency." },
        { left: "A law says the data must stay in one country", right: "Choose a Region located in that country", why: "A Region's geography is the physical location of its infrastructure." },
        { left: "A service you depend on isn't offered there", right: "Choose a Region that has the services you need", why: "Not every service or feature is available in every Region." },
      ],
      explanation: "Closeness to users, legal requirements and available services are the usual three questions when picking a Region.",
      source: REGIONS,
      domains: ["clf-3"],
      pillars: [],
    },
    {
      type: "card",
      id: "card-zones",
      concept: "zones",
      title: "A Region is made of Availability Zones",
      body: "Every Region has at least three Availability Zones, and each zone is one or more data centres with its own power and networking. Zones sit up to about 100 km apart, far enough that a single disaster shouldn't reach two of them.",
      diagram: [
        { id: "london", icon: "region", label: "eu-west-2", tag: "Europe (London)", holds: ["eu-west-2a", "eu-west-2b", "eu-west-2c"] },
      ],
    },
    {
      type: "choice",
      id: "flood-in-one-zone",
      concept: "zones",
      prompt: "A flood knocks out the data centres of one Availability Zone. What is affected?",
      options: [
        { id: "zone", text: "That one zone. The Region's other zones keep running", correct: true, why: "Zones are built so that a flood, a fire or a power cut in one doesn't spread to the next." },
        { id: "region", text: "The whole Region, since its zones share power and cooling", why: "They don't share those. Generators and cooling are kept separate for each zone." },
        { id: "all", text: "Every Region, because AWS is one connected network", why: "Regions are isolated from each other, and so are the zones inside them." },
        { id: "nothing", text: "Nothing. Each data centre is flood-proof", why: "Zones can fail. The design assumes they will, which is why there are several." },
      ],
      explanation: "Zones are placed far enough apart, and on separate enough equipment, that they shouldn't share a fate.",
      source: ISOLATION_ZONES,
      domains: ["clf-3", "saa-2"],
      pillars: ["reliability"],
    },
    {
      type: "choice",
      id: "reading-a-zone-code",
      concept: "zones",
      prompt: "What does the code eu-west-2b refer to?",
      options: [
        { id: "zone", text: "One Availability Zone in the London Region", correct: true, why: "A zone's code is its Region's code followed by a letter." },
        { id: "region", text: "A second London Region", why: "The Region is eu-west-2. The letter on the end picks out one zone inside it." },
        { id: "rack", text: "A particular rack of servers", why: "Codes don't go that fine. A zone is one or more whole data centres." },
        { id: "version", text: "The second version of the eu-west-2 Region", why: "The letter isn't a version. It names a zone." },
      ],
      explanation: "eu-west-2 is the Region, and eu-west-2a, eu-west-2b and so on are the zones inside it.",
      source: ZONES,
      domains: ["clf-3"],
      pillars: [],
    },
    {
      type: "match",
      id: "infrastructure-vocabulary",
      concept: "zones",
      prompt: "Match each term or code to what it is.",
      pairs: [
        { left: "Region", right: "A geographic area, isolated from the others", why: "A Region is the large unit: a whole geographic area with its own zones." },
        { left: "Availability Zone", right: "One or more data centres with their own power and networking", why: "A zone is the unit inside a Region that can fail on its own." },
        { left: "eu-west-2", right: "The code for a Region", why: "A Region code has no letter on the end." },
        { left: "eu-west-2a", right: "The code for an Availability Zone", why: "A zone code is the Region code plus a letter." },
      ],
      explanation: "Regions contain zones, and zones contain data centres. The codes follow the same nesting.",
      source: ZONES,
      domains: ["clf-3"],
      pillars: [],
    },
    {
      type: "choice",
      id: "why-not-further-apart",
      concept: "zones",
      prompt: "The zones in a Region are kept within about 100 km of each other. Why not put them much further apart, to be safer still?",
      options: [
        { id: "sync", text: "They need to be close enough to copy data between them almost instantly", correct: true, why: "At this distance, data can be written to two zones at once with only a few milliseconds of delay." },
        { id: "law", text: "The law requires a Region to fit inside one city", why: "No such rule exists. The distance is an engineering trade-off." },
        { id: "staff", text: "So that the same engineers can reach every zone", why: "Staffing isn't the reason. The limit comes from how fast data can travel between zones." },
        { id: "land", text: "Because land further out costs more", why: "Cost of land isn't the constraint. Network delay between zones is." },
      ],
      explanation: "Far enough apart to avoid sharing a disaster, close enough to stay in step: that balance is what makes a standby in another zone practical.",
      source: ISOLATION_ZONES,
      domains: ["clf-3", "saa-2"],
      pillars: ["reliability", "performance-efficiency"],
    },
    {
      type: "card",
      id: "card-multi-az",
      concept: "multi-az",
      title: "Spread across zones to survive one failing",
      body: "Anything you run in a single zone goes down when that zone does. Put a copy in a second zone and the app can keep serving while one of them is dark.",
      diagram: [
        { id: "london", icon: "region", label: "eu-west-2", tag: "Europe (London)", holds: ["eu-west-2a · web server", "eu-west-2b · web server"] },
      ],
    },
    {
      type: "choice",
      id: "second-server-where",
      concept: "multi-az",
      prompt: "Your app runs on one server in eu-west-2a. You can add one more server. Where does it go, so the app survives a zone failing?",
      options: [
        { id: "other-zone", text: "In eu-west-2b", correct: true, why: "A different zone in the same Region doesn't share the first one's fate." },
        { id: "same-zone", text: "In eu-west-2a, next to the first", why: "Two servers in one zone fail together when that zone does." },
        { id: "bigger", text: "Nowhere new. Make the existing server larger", why: "A larger server is still one server in one zone." },
        { id: "other-region", text: "In US East (N. Virginia)", why: "That would survive, but nothing is shared between Regions, so you would be copying everything across yourself. A second zone is enough here." },
      ],
      explanation: "By launching resources in separate zones, you protect an application from the failure of a single zone.",
      source: SUBNETS,
      domains: ["clf-3", "saa-2"],
      pillars: ["reliability"],
    },
    {
      type: "choice",
      id: "already-multi-zone",
      concept: "multi-az",
      prompt: "A zone fails with no warning. Which of these survives without you having set anything up?",
      options: [
        { id: "s3", text: "The files in your S3 bucket", correct: true, why: "S3 stores objects redundantly across several zones for you." },
        { id: "server", text: "A single virtual server in that zone", why: "A server lives in one zone. If that zone is gone, so is the server." },
        { id: "db", text: "A database installed on that server", why: "The database goes down with the server it runs on." },
        { id: "reboot", text: "Everything in the zone, after a restart", why: "A restart can't help while the zone itself is unavailable." },
      ],
      explanation: "Some services spread across zones for you, and others leave it to you. Knowing which is which is half of designing for failure.",
      source: S3_WELCOME,
      domains: ["clf-3", "saa-2"],
      pillars: ["reliability"],
    },
    {
      type: "choice",
      id: "zones-are-not-regions",
      concept: "multi-az",
      prompt: "Your app is spread across two zones in London. Does that protect it if the whole London Region has a problem?",
      options: [
        { id: "no", text: "No. Zones protect against a zone failing, not a Region", correct: true, why: "Both zones are inside the Region, so a Region-wide problem reaches both." },
        { id: "independent", text: "Yes, because zones are independent of each other", why: "They are independent of each other, but they all belong to the same Region." },
        { id: "auto", text: "Yes, AWS moves the app to Ireland automatically", why: "Nothing of yours exists in Ireland unless you put it there yourself." },
        { id: "static", text: "Only for the parts of the app that never change", why: "The kind of content doesn't matter. Everything in that Region is in the same position." },
      ],
      explanation: "Two zones is the standard answer to a data centre failing. Surviving the loss of a whole Region means building in a second one, which is a much bigger job.",
      source: ISOLATION_REGIONS,
      domains: ["saa-2"],
      pillars: ["reliability"],
    },
  ],
};
