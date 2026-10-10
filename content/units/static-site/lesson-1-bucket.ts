import type { Lesson } from "@/content/schema";

// DRAFT — awaiting review. Written from the Amazon S3 User Guide; every exercise links the page it rests on.

const S3_WELCOME = {
  title: "What is Amazon S3?",
  url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html",
};
const S3_NAMING = {
  title: "General purpose bucket naming rules",
  url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/bucketnamingrules.html",
};
const S3_INDEX = {
  title: "Configuring an index document",
  url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/IndexDocumentSupport.html",
};
const S3_BPA = {
  title: "Blocking public access to your Amazon S3 storage",
  url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html",
};
const S3_WEBSITE_PERMISSIONS = {
  title: "Setting permissions for website access",
  url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteAccessPermissionsReqd.html",
};
const S3_WEBSITE = {
  title: "Hosting a static website using Amazon S3",
  url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html",
};
const S3_ENDPOINTS = {
  title: "Website endpoints",
  url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteEndpoints.html",
};

export const bucket: Lesson = {
  id: "bucket",
  title: "A bucket for the site",
  summary: "Where the files live, who can read them, and how a bucket answers a browser.",
  steps: [
    {
      type: "card",
      id: "card-objects",
      concept: "s3-objects",
      title: "A bucket holds objects",
      body: "A bucket is a container for objects, and an object is a file plus the metadata that describes it. Each object has a key, which is its unique name inside the bucket.",
      diagram: [
        { id: "bucket", icon: "bucket", label: "my-site", tag: "S3 bucket", holds: ["index.html", "css/site.css", "img/logo.png"] },
      ],
    },
    {
      type: "choice",
      id: "key-with-folder",
      concept: "s3-objects",
      prompt: "You upload logo.png into a folder named img in your bucket. What is the object's key?",
      options: [
        { id: "full", text: "img/logo.png", correct: true, why: "The folder name is part of the key. A bucket is flat, and folders are implied by the keys." },
        { id: "name", text: "logo.png", why: "That would be the key only if the file sat at the root of the bucket. The folder name is part of the key." },
        { id: "bucket", text: "The name of the bucket", why: "The bucket name identifies the container. The key identifies one object inside it." },
        { id: "meta", text: "Its Content-Type metadata", why: "Metadata describes an object. It doesn't identify it." },
      ],
      explanation: "A bucket has no real folders. The console shows them, but the object is simply stored under the key img/logo.png.",
      source: S3_INDEX,
      domains: ["clf-3"],
      pillars: [],
    },
    {
      type: "match",
      id: "s3-vocabulary",
      concept: "s3-objects",
      prompt: "Match each S3 term to what it means.",
      pairs: [
        { left: "Bucket", right: "A container for objects", why: "A bucket is the container. You create it first, then upload into it." },
        { left: "Object", right: "A file and the metadata describing it", why: "An object is the data itself together with its metadata, such as Content-Type." },
        { left: "Key", right: "An object's unique name within its bucket", why: "Every object in a bucket has exactly one key." },
        { left: "Region", right: "Where the bucket lives, chosen when you create it", why: "You pick a Region at creation and can't change it afterwards." },
      ],
      explanation: "To store anything in S3 you create a bucket in a Region, then upload objects, each under its own key.",
      source: S3_WELCOME,
      domains: ["clf-3"],
      pillars: [],
    },
    {
      type: "choice",
      id: "name-collision",
      concept: "s3-objects",
      prompt: "Another company, in a different AWS account and Region, already has a bucket named assets. You try to create one with the same name. What happens?",
      options: [
        { id: "fails", text: "It fails, because the name is taken", correct: true, why: "By default a bucket name must be unique across every AWS account and Region." },
        { id: "account", text: "It works, because the accounts are different", why: "Bucket names aren't scoped to your account by default. They share one global namespace." },
        { id: "region", text: "It works, because the Regions are different", why: "A bucket lives in one Region, but its name still has to be unique across all of them." },
        { id: "suffix", text: "It works, and AWS quietly adds your account ID to the name", why: "S3 never renames a bucket for you. The request is rejected." },
      ],
      explanation: "The bucket name appears in the URLs of its objects, which is why names are shared across all of AWS by default.",
      source: S3_NAMING,
      domains: ["clf-3"],
      pillars: [],
    },
    {
      type: "slot",
      id: "where-files-live",
      concept: "s3-objects",
      prompt: "A visitor's browser asks for your site's files. Something has to hold those files and hand them over. What goes in the gap?",
      diagram: [{ id: "visitor", icon: "visitor", label: "Visitor", tag: "browser" }],
      gap: 1,
      options: [
        { part: { id: "s3", icon: "bucket", label: "S3 bucket", tag: "object storage" }, correct: true, why: "Object storage is built for exactly this: keeping files and returning them on request." },
        { part: { id: "ec2", icon: "server", label: "Virtual server", tag: "EC2 instance" }, why: "A server could do it, but you would be running and patching a machine just to hand out files that never change." },
        { part: { id: "rds", icon: "database", label: "Relational database", tag: "RDS" }, why: "A database stores rows for an application to query. It isn't a place browsers fetch files from." },
        { part: { id: "iam", icon: "policy", label: "Access policy", tag: "IAM" }, why: "A policy decides who is allowed to do what. It doesn't hold any files." },
      ],
      explanation: "The pages, styles and images of a static site are just files, so they belong in object storage.",
      source: S3_WELCOME,
      domains: ["clf-3", "saa-4"],
      pillars: ["cost-optimization"],
    },
    {
      type: "card",
      id: "card-private",
      concept: "s3-private",
      title: "Private until you say otherwise",
      body: "A new bucket and everything in it is private. Block Public Access is switched on by default, and it overrides any policy that tries to open the bucket up.",
      diagram: [
        { id: "visitor", icon: "visitor", label: "Anyone", tag: "internet" },
        { id: "bucket", icon: "bucket", label: "my-site", tag: "blocked by default" },
      ],
    },
    {
      type: "choice",
      id: "fresh-bucket-url",
      concept: "s3-private",
      prompt: "You create a bucket, upload index.html, and send a friend the object's URL. You changed no settings. What does your friend get?",
      options: [
        { id: "denied", text: "An access denied error", correct: true, why: "Buckets and objects are private unless you explicitly grant access." },
        { id: "page", text: "The page, rendered in their browser", why: "That needs public read access, which a new bucket doesn't have." },
        { id: "list", text: "A list of every file in the bucket", why: "Listing the bucket needs permission too, and nothing has been granted." },
        { id: "login", text: "An AWS sign-in page", why: "S3 doesn't redirect anonymous requests to a sign-in page. It refuses them." },
      ],
      explanation: "Nothing in S3 is public by accident. You have access only to what you create, until you grant more.",
      source: S3_BPA,
      domains: ["clf-2", "saa-1"],
      pillars: ["security"],
    },
    {
      type: "choice",
      id: "make-public",
      concept: "s3-private",
      prompt: "You decide to serve a site straight from a bucket, readable by everyone. What has to change?",
      options: [
        {
          id: "both",
          text: "Turn off Block Public Access for the bucket, and add a bucket policy that lets everyone read its objects",
          correct: true,
          why: "It takes both: one removes the block, the other grants the access.",
        },
        { id: "policy", text: "Only add a bucket policy that lets everyone read its objects", why: "Block Public Access overrides the policy, so the bucket stays closed." },
        { id: "block", text: "Only turn off Block Public Access", why: "Removing the block grants nothing by itself. Without a policy the objects are still private." },
        { id: "rename", text: "Rename the bucket to match the site's domain", why: "A name doesn't affect who can read a bucket, and a bucket can't be renamed anyway." },
      ],
      explanation: "Opening a bucket is deliberately a two-step job. AWS recommends leaving Block Public Access on unless you are sure you need it off.",
      source: S3_WEBSITE_PERMISSIONS,
      domains: ["clf-2", "saa-1"],
      pillars: ["security"],
    },
    {
      type: "card",
      id: "card-website",
      concept: "s3-website",
      title: "A bucket can answer a browser",
      body: "Switch on static website hosting and the bucket gets a website endpoint, which returns your index document when someone asks for the root. It hands files over exactly as stored, and only over HTTP.",
      diagram: [
        { id: "visitor", icon: "visitor", label: "Visitor", tag: "http://" },
        { id: "endpoint", icon: "bucket", label: "my-site", tag: "website endpoint", holds: ["index.html", "error.html"] },
      ],
    },
    {
      type: "choice",
      id: "root-request",
      concept: "s3-website",
      prompt: "A visitor opens your website endpoint without naming a file. What does S3 send back?",
      options: [
        { id: "index", text: "The index document, such as index.html", correct: true, why: "That is what the index document is for: the page returned for the root or a folder." },
        { id: "list", text: "A list of the keys in the bucket", why: "That is how the REST API endpoint answers. The website endpoint returns the index document." },
        { id: "first", text: "Whichever object comes first alphabetically", why: "S3 doesn't guess. It returns the index document you named in the website settings." },
        { id: "notfound", text: "A 404, because no file was requested", why: "A 404 is for an object that doesn't exist. A request for the root is answered with the index document." },
      ],
      explanation: "You name the index document when you turn on website hosting, then upload a file with exactly that name.",
      source: S3_INDEX,
      domains: ["clf-3"],
      pillars: [],
    },
    {
      type: "match",
      id: "endpoint-differences",
      concept: "s3-website",
      prompt: "A bucket has two kinds of endpoint. Match each situation to what comes back.",
      pairs: [
        { left: "Website endpoint, request for the root", right: "The index document", why: "The website endpoint is built for browsers, so the root returns a page." },
        { left: "REST API endpoint, request for the root", right: "A list of object keys", why: "The REST API endpoint is built for programs, so the root lists the bucket." },
        { left: "Website endpoint, something goes wrong", right: "An HTML error page", why: "Browsers get an HTML document they can display." },
        { left: "REST API endpoint, something goes wrong", right: "An XML error response", why: "Programs get a structured XML error they can parse." },
      ],
      explanation: "The website endpoint is tuned for people in browsers, and the REST API endpoint for code.",
      source: S3_ENDPOINTS,
      domains: ["clf-3"],
      pillars: [],
    },
    {
      type: "fix",
      id: "server-side-script",
      concept: "s3-website",
      prompt: "A team sketches their new site. One part of this can't work on a static website. Find it, then choose what to use.",
      diagram: [
        { id: "visitor", icon: "visitor", label: "Visitor", tag: "browser" },
        { id: "endpoint", icon: "bucket", label: "my-site", tag: "website endpoint" },
        { id: "php", icon: "script", label: "checkout.php", tag: "runs on each request" },
      ],
      faulty: "php",
      innocent: {
        visitor: "A visitor's browser asking for pages is exactly what a website endpoint expects.",
        endpoint: "A bucket's website endpoint is a fine place to serve static pages from.",
      },
      replacements: [
        { id: "js", text: "JavaScript that runs in the visitor's browser", correct: true, why: "A static page can carry client-side scripts. The browser runs them, not S3." },
        { id: "jsp", text: "A JSP page", why: "That is another server-side script. The endpoint would return its source, not run it." },
        { id: "bigger", text: "A bucket in a larger Region", why: "Size isn't the problem. The endpoint returns files as they are and never runs code." },
      ],
      explanation: "A website endpoint answers requests for objects by returning them. Pages can include scripts, but only ones the browser runs.",
      source: S3_WEBSITE,
      domains: ["clf-3", "saa-3"],
      pillars: [],
    },
    {
      type: "choice",
      id: "https-on-endpoint",
      concept: "s3-website",
      prompt: "Your site has to be served over HTTPS. Can the bucket's website endpoint do that without help?",
      options: [
        { id: "no", text: "No. Something has to sit in front of it", correct: true, why: "Website endpoints don't support HTTPS, so another service has to provide it." },
        { id: "auto", text: "Yes, HTTPS is on automatically", why: "The website endpoint answers over HTTP only." },
        { id: "cert", text: "Yes, once you upload a certificate into the bucket", why: "A certificate stored as an object is just a file. The endpoint can't use it." },
        { id: "setting", text: "Yes, after turning off Block Public Access", why: "That setting controls who can read the bucket. It has nothing to do with encryption in transit." },
      ],
      explanation: "This is the gap the next lesson fills: a service that sits in front of the bucket and speaks HTTPS to visitors.",
      source: S3_ENDPOINTS,
      domains: ["clf-2", "saa-1"],
      pillars: ["security"],
    },
  ],
};
