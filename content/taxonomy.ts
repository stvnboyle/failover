// The exam blueprints and Well-Architected pillars that exercises are tagged against. Kept apart
// from the schema so that pages which only need the names don't pull the validation library into the browser.

// From the official exam guides. Checked 2026-10-10: CLF-C02 and SAA-C03 are the live versions.
export const EXAM_DOMAINS = {
  "clf-1": { exam: "CLF-C02", name: "Cloud Concepts", weight: 24 },
  "clf-2": { exam: "CLF-C02", name: "Security and Compliance", weight: 30 },
  "clf-3": { exam: "CLF-C02", name: "Cloud Technology and Services", weight: 34 },
  "clf-4": { exam: "CLF-C02", name: "Billing, Pricing, and Support", weight: 12 },
  "saa-1": { exam: "SAA-C03", name: "Design Secure Architectures", weight: 30 },
  "saa-2": { exam: "SAA-C03", name: "Design Resilient Architectures", weight: 26 },
  "saa-3": { exam: "SAA-C03", name: "Design High-Performing Architectures", weight: 24 },
  "saa-4": { exam: "SAA-C03", name: "Design Cost-Optimized Architectures", weight: 20 },
} as const;

export const PILLARS = {
  "operational-excellence": "Operational Excellence",
  security: "Security",
  reliability: "Reliability",
  "performance-efficiency": "Performance Efficiency",
  "cost-optimization": "Cost Optimization",
  sustainability: "Sustainability",
} as const;
