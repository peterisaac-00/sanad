export interface KnowledgeArticle {
  slug: string;
  title_ar: string;
  title_en: string;
  summary_ar: string;
  summary_en: string;
  category_ar: string;
  category_en: string;
  reading_time_min: number;
  published_date: string;
  sections_ar: { heading: string; content: string }[];
  sections_en: { heading: string; content: string }[];
}

export const KNOWLEDGE_ARTICLES: KnowledgeArticle[] = [
  {
    slug: 'reduce-cod-returns-and-cancellations',
    title_ar: 'استراتيجية خفض مرتجعات وإلغاءات الدفع عند الاستلام (COD) بنسبة 40%',
    title_en: 'Strategy to Slash Cash on Delivery (COD) Returns & Cancellations by 40%',
    summary_ar: 'دليل عملي لتجار مصر والعالم العربي لإحكام السيطرة على طرود الشحن، تقليل تكاليف الشحن الضائعة، وتحويل متسوقي COD إلى مشترين جادين.',
    summary_en: 'A practical framework for Arab merchants to control return rates, cut wasted courier fees, and qualify COD buyers.',
    category_ar: 'العمليات والشحن',
    category_en: 'Operations & Logistics',
    reading_time_min: 7,
    published_date: '2026-10-01',
    sections_ar: [
      {
        heading: 'لماذا يفشل نموذج الدفع عند الاستلام التقليدي؟',
        content: 'في مصر والعديد من الأسواق العربية، يمثل الدفع عند الاستلام (COD) أكثر من 65% من رغبة المتسوقين بسبب الحذر من المعاملات الرقمية أو غياب البطاقات الائتمانية. ومع ذلك، يعاني التاجر من ظاهرة "إلغاء الطلب عند وصول المندوب" أو "عدم الرد على الهاتف"، مما يكبد التاجر تكلفة شحن ذهاباً وإياباً دون إيراد.'
      },
      {
        heading: 'الخطوة الأولى: التأكيد الفوري عبر واتساب أو الاتصال',
        content: 'تأكيد الطلب خلال أول 30 دقيقة من تسجيله يرفع نسبة التسليم بنسبة 25%. استخدم قالب رسالة واتساب رسمي يتضمن اسم العميل، العنوان بالتفصيل (رقم العمارة والشقة)، واسم المنتج، واطلب منه الرد بكلمة "تأكيد" للبدء في تجهيز الشحنة.'
      },
      {
        heading: 'الخطوة الثانية: سياسة الرسوم الرمزية للـ COD',
        content: 'فرض رسم رمزي على خيار الدفع عند الاستلام (مثلاً 15 أو 20 جنيهاً مصرياً) مع تقديم الدفع الإلكتروني (إنستاباي / فودافون كاش / بطاقات) مجاناً بالكامل. هذا الحافز المالي يدفع نسبة ملحوظة من العملاء للدفع المسبق ويضمن جديتهم التامة.'
      },
      {
        heading: 'الخطوة الثالثة: إشعار يوم التسليم الصباحي',
        content: 'أغلب حالات تعذر التسليم تعود إلى عدم وجود المشتري في المنزل أو عدم توفر السيولة النقدية معه. إرسال رسالة تذكير صباح يوم خروج المندوب: "طردك مع مندوب شركة بوسطة/أرامكس اليوم، المبلغ المطلوب تسليمه كاش هو X ج.م" يرفع معدل الاستلام بنجاح كبير.'
      }
    ],
    sections_en: [
      {
        heading: 'Why the Traditional COD Model Fails Without Structure',
        content: 'In Egypt and key regional markets, COD accounts for over 65% of ecommerce orders due to payment preferences. Merchants frequently suffer from door-step refusals and unreachable recipients, burning two-way courier fees.'
      },
      {
        heading: 'Step 1: Rapid Order Confirmation via WhatsApp',
        content: 'Confirming the order within 30 minutes lifts successful deliveries by 25%. A standardized WhatsApp message verifying the exact apartment number and asking for a single-word confirmation filters out impulsive fake orders.'
      },
      {
        heading: 'Step 2: Nominal COD Handling Surcharge Policy',
        content: 'Applying a nominal surcharge on COD while keeping digital pre-payment free creates a powerful psychological incentive to pay beforehand and dramatically increases buyer commitment.'
      },
      {
        heading: 'Step 3: Same-Day Delivery Morning Notification',
        content: 'Most failed delivery attempts occur because the customer is not home or lacks exact cash change. A morning notification stating the courier name and exact cash required drastically improves first-attempt completions.'
      }
    ]
  },
  {
    slug: 'cross-border-selling-egypt-to-gulf',
    title_ar: 'التصدير الرقمي: كيف تبيع من مصر إلى عملاء السعودية والإمارات والخليج؟',
    title_en: 'Cross-Border Ecommerce: How to Sell from Egypt to Saudi Arabia & GCC',
    summary_ar: 'خطوات عملية لتهيئة متجرك، تسعير المنتجات بالريال والدولار، تنظيم الشحن الجوي السريع، والامتثال لمتطلبات الجمارك.',
    summary_en: 'Comprehensive roadmap for Egyptian merchants to expand into the GCC: multi-currency pricing, express couriers, and customs compliance.',
    category_ar: 'التوسع الإقليمي',
    category_en: 'Cross-Border Expansion',
    reading_time_min: 9,
    published_date: '2026-09-24',
    sections_ar: [
      {
        heading: 'فرصة التوسع الخليجي للعلامات المصرية',
        content: 'تتمتع المنتجات المصرية في قطاعات الأزياء، المشغولات اليدوية، الأحذية، العطور والمنتجات الغذائية بطلب استثنائي في السعودية والإمارات والكويت. ومع ارتفاع القوة الشرائية في الخليج، يرتفع متوسط قيمة الطلب (AOV) إلى 4-6 أضعاف السوق المحلي.'
      },
      {
        heading: 'تسعير المنتجات بالعملة المحلية للمشتري',
        content: 'لا تعرض المنتجات للمتسوق السعودي بالجنيه المصري؛ اعرضها بالريال السعودي (SAR) مباشرة مع اعتماد هامش أمان طفيف (2-3%) لتغطية تقلبات أسعار الصرف ورسوم التحويل البنكي.'
      },
      {
        heading: 'الشحن الدولي المباشر والجمارك',
        content: 'اختر شركات شحن توفر خدمة الشحن الجوي السريع من الباب إلى الباب (خلال 3 إلى 5 أيام عمل) مع إصدار الفاتورة التجارية Commercial Invoice باللغتين العربية والإنجليزية وتوضيح رمز النظام المنسق HS Code لكل صنف.'
      },
      {
        heading: 'خيارات الدفع الملائمة للخليج',
        content: 'في السعودية والخليج، الدفع الإلكتروني عبر Apple Pay وبطاقات مدى والبطاقات الائتمانية هو الخيار السائد. تأكد من تفعيل هذه الخيارات لتجنب مخاطر الشحن الدولي بالدفع عند الاستلام.'
      }
    ],
    sections_en: [
      {
        heading: 'The Gulf Expansion Opportunity for Egyptian Brands',
        content: 'Egyptian apparel, footwear, artisanal crafts, and specialty goods enjoy huge demand across Saudi Arabia, the UAE, and Kuwait. Average Order Values in the Gulf are 4 to 6 times higher than domestic benchmarks.'
      },
      {
        heading: 'Localized Currency Display',
        content: 'Never present prices to Gulf buyers in EGP; render native SAR or AED currencies with a transparent FX buffer to protect against currency fluctuations.'
      },
      {
        heading: 'Direct International Air Express & Customs',
        content: 'Partner with express air couriers providing door-to-door transit within 3 to 5 business days, with automated bilingual commercial invoices and proper HS codes.'
      },
      {
        heading: 'Payment Methods Tailored to the GCC',
        content: 'Digital payments via Apple Pay, Mada, and international credit cards dominate the Gulf. Enabling seamless card and digital wallet checkouts eliminates international COD risk.'
      }
    ]
  },
  {
    slug: 'whatsapp-commerce-conversion-playbook',
    title_ar: 'دليل WhatsApp Commerce: تحويل المحادثات إلى طلبات مؤكدة ومبيعات متكررة',
    title_en: 'WhatsApp Commerce Playbook: Converting Chats to Confirmed Orders',
    summary_ar: 'كيف تستخدم واتساب كأداة تشغيل وتجارة متكاملة وليس مجرد تطبيق دردشة للدعم الفني.',
    summary_en: 'How to utilize WhatsApp as a complete commerce operating channel rather than just a support chat.',
    category_ar: 'التسويق والمبيعات',
    category_en: 'Marketing & Sales',
    reading_time_min: 6,
    published_date: '2026-09-15',
    sections_ar: [
      {
        heading: 'الواتساب هو القناة المفضلة للمستهلك العربي',
        content: 'في العالم العربي، يتم فتح رسائل واتساب بمعدل يتجاوز 90% مقارنة بأقل من 15% للبريد الإلكتروني التقليدي. المتسوق العربي يثق بالتاجر الذي يمكنه التحدث معه مباشرة والتأكد من تفاصيل المنتج.'
      },
      {
        heading: 'استرجاع السلات المتروكة بنقرة واحدة',
        content: 'عندما يترك العميل بياناته في مرحلة إتمام الطلب دون إكمال الشراء، أرسل له بعد ساعتين رسالة ودية تتضمن رابطاً مباشراً لسلة مشترياته المحفوظة مع استفسار إذا كان يواجه أي صعوبة في اختيار المقاس أو وسيلة الدفع.'
      },
      {
        heading: 'بناء مجتمع عملاء وتكرار الشراء',
        content: 'إرسال عروض خاصة أو إشعار بمنتجات جديدة إلى العملاء السابقين عبر رسائل مخصصة يعزز نسبة تكرار الشراء دون الحاجة لإنفاق ميزانيات إعلانية إضافية على فيسبوك وتيك توك.'
      }
    ],
    sections_en: [
      {
        heading: 'WhatsApp as the Preferred Arab Shopper Channel',
        content: 'In the Arab world, WhatsApp boasts over 90% open rates compared to under 15% for email. Direct personal verification provides immediate reassurance.'
      },
      {
        heading: 'Frictionless Abandoned Cart Recovery',
        content: 'When shoppers abandon checkout after inputting contact info, dispatch a polite message after two hours with their pre-filled cart link to resolve questions.'
      },
      {
        heading: 'Repeat Customer Retention & Re-ordering',
        content: 'Notifying past buyers about exclusive new arrivals generates high-margin repeat revenue with zero extra advertising expenditure.'
      }
    ]
  },
  {
    slug: 'meta-capi-and-google-shopping-setup',
    title_ar: 'دليل تعليمي: Meta Conversions API و Google Merchant Center (خارج سند)',
    title_en: 'Guide: Meta Conversions API & Google Merchant Center (Outside Sanad)',
    summary_ar: 'دليل عام لتحسين تتبع الإعلانات وتغذية كتالوج Google. لا يوفر سند تكامل Meta CAPI أو Google Merchant Center في النسخة الحالية؛ نفّذ ذلك بأدوات خارجية.',
    summary_en: 'A general guide to advertising attribution and Google catalogue feeds. Sanad does not provide Meta CAPI or Google Merchant Center integration in the current release; use external tools.',
    category_ar: 'الإعلانات والنمو',
    category_en: 'Ads & Attribution',
    reading_time_min: 8,
    published_date: '2026-09-08',
    sections_ar: [
      {
        heading: 'أزمة تتبع البكسل التقليدي وتراجع عائد الإعلانات',
        content: 'منذ تحديثات خصوصية متصفحات سفاري وتحديث iOS 14.5، يفقد بكسل فيسبوك العادي ما بين 25% إلى 40% من بيانات المبيعات الحقيقية. هذا يجعل مديري الحملات يظنون أن الإعلانات غير مربحة، في حين أن المبيعات تحدث ولكن لا تُسجل.'
      },
      {
        heading: 'الحل: واجهة تحويلات الخادم (Conversions API - CAPI)',
        content: 'إذا كنت تستخدم أداة خارجية أو مطوراً، يمكنك إرسال إشارة الشراء (Purchase Event) من خادمك إلى خوادم ميتا مصحوبة برقم الطلب وقيمته. سند لا يرسل هذه الإشارة تلقائياً ولا يوفر تكامل CAPI في النسخة الحالية.'
      },
      {
        heading: 'خلاصة المنتجات لـ Google Shopping',
        content: 'يحتاج عرض المنتجات في Google Shopping إلى ملف تغذية كتالوج (XML Feed) تبنيها بأداة خارجية وتحدّثها بنفسك. سند لا يولّد هذا الملف تلقائياً؛ تصدير الطلبات والعملاء CSV هو المتاح حالياً.'
      }
    ],
    sections_en: [
      {
        heading: 'The Tracking Dilemma and Signal Loss',
        content: 'Browser cookie restrictions drop 25% to 40% of standard client-side pixel events, causing ad managers to misjudge real campaign profitability.'
      },
      {
        heading: 'The Solution: Server-Side Conversions API (CAPI)',
        content: 'Server-side CAPI dispatches purchase events directly from backend to Meta servers with order ID and currency value, restoring full attribution.'
      },
      {
        heading: 'Automated Real-Time Product Feeds for Google Shopping',
        content: 'Live XML feeds ensure that Google Shopping and Performance Max campaigns automatically sync up-to-date pricing and inventory availability.'
      }
    ]
  }
];
