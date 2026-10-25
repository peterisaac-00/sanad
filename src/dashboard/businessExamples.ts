export interface BusinessExamples {
  productAr: string;
  productEn: string;
  sku: string;
  featuresAr: string;
  audienceAr: string;
  categoryAr: string;
  offerAr: string;
  relatedAr: string;
}

const EXAMPLES: Record<string, BusinessExamples> = {
  fashion: {
    productAr: "قميص قطني أسود",
    productEn: "Black Cotton T-Shirt",
    sku: "FASHION-BLK-L",
    featuresAr: "قطن ناعم، مقاسات متعددة، لون أسود",
    audienceAr: "عملاء يهتمون بالموضة والملابس اليومية",
    categoryAr: "ملابس رجالية",
    offerAr: "خصم 20% على التشكيلة الجديدة",
    relatedAr: "اعرض الحزام مع القميص",
  },
  electronics: {
    productAr: "سماعة لاسلكية عازلة للضوضاء",
    productEn: "Wireless Noise-Cancelling Headphones",
    sku: "ELEC-HEAD-001",
    featuresAr: "بلوتوث 5.3، بطارية 30 ساعة، شحن سريع",
    audienceAr: "عملاء يبحثون عن أجهزة وإكسسوارات تقنية",
    categoryAr: "إكسسوارات إلكترونية",
    offerAr: "خصم 15% على الأجهزة الجديدة",
    relatedAr: "اعرض الشاحن مع السماعة",
  },
  restaurant: {
    productAr: "برجر لحم كلاسيك",
    productEn: "Classic Beef Burger",
    sku: "FOOD-BRG-001",
    featuresAr: "لحم طازج، جبنة شيدر، صوص خاص",
    audienceAr: "عملاء يبحثون عن وجبات سريعة وطعام شهي",
    categoryAr: "الوجبات الرئيسية",
    offerAr: "وجبة كاملة بسعر خاص اليوم",
    relatedAr: "اعرض البطاطس والمشروب مع الوجبة",
  },
  beauty: {
    productAr: "سيروم فيتامين سي",
    productEn: "Vitamin C Face Serum",
    sku: "BEAUTY-SER-001",
    featuresAr: "تركيبة خفيفة، ترطيب عميق، مناسب للبشرة الحساسة",
    audienceAr: "عملاء مهتمون بالعناية بالبشرة والجمال",
    categoryAr: "العناية بالبشرة",
    offerAr: "خصم 20% على منتجات العناية",
    relatedAr: "اعرض المرطب مع السيروم",
  },
  furniture: {
    productAr: "كرسي مكتب مريح",
    productEn: "Ergonomic Office Chair",
    sku: "FURN-CHAIR-001",
    featuresAr: "ظهر مريح، ارتفاع قابل للتعديل، خامة متينة",
    audienceAr: "عملاء يبحثون عن أثاث عملي للمنزل والمكتب",
    categoryAr: "أثاث مكتبي",
    offerAr: "شحن مجاني على الأثاث المختار",
    relatedAr: "اعرض المكتب مع الكرسي",
  },
  digital: {
    productAr: "دليل التسويق الرقمي",
    productEn: "Digital Marketing Guide",
    sku: "DIGITAL-GUIDE-001",
    featuresAr: "ملف PDF، خطوات عملية، تحديثات مجانية",
    audienceAr: "أصحاب المشاريع والمهتمون بالتسويق الرقمي",
    categoryAr: "كتب وملفات رقمية",
    offerAr: "خصم 25% على المنتجات الرقمية",
    relatedAr: "اعرض القالب مع الدليل",
  },
  services: {
    productAr: "تصميم هوية بصرية",
    productEn: "Visual Brand Identity Design",
    sku: "SERVICE-BRAND-001",
    featuresAr: "شعار، ألوان، ملفات جاهزة للاستخدام",
    audienceAr: "أصحاب المشاريع الذين يحتاجون خدمات احترافية",
    categoryAr: "خدمات التصميم",
    offerAr: "استشارة مجانية مع حجز الخدمة",
    relatedAr: "اعرض تصميم المطبوعات مع الهوية",
  },
  other: {
    productAr: "منتج مميز",
    productEn: "Featured Product",
    sku: "PRODUCT-001",
    featuresAr: "جودة عالية، تصميم عملي، قيمة ممتازة",
    audienceAr: "عملاء مهتمون بمنتجات متجرك",
    categoryAr: "منتجات متنوعة",
    offerAr: "خصم خاص لفترة محدودة",
    relatedAr: "اعرض منتجاً مرتبطاً معه",
  },
};

export function getBusinessExamples(businessType?: string): BusinessExamples {
  return EXAMPLES[businessType ?? "other"] ?? EXAMPLES.other;
}
