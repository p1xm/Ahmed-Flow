/* =====================================================================
   خرائط حرب المناطق — 4 دول × 20 منطقة
   كل منطقة: id, n=الاسم, x,y=مكانها في الشبكة, v=القيمة (1-4), cap=عاصمة
   المناطق المتجاورة في الشبكة (فوق/تحت/يمين/شمال) = متجاورة تلقائيًا
   links = حدود إضافية بين مناطق مش متلاصقة في الرسم
   الخريطة مبسّطة (مش حدود جغرافية دقيقة) عشان تبان كويس على الموبايل
   ===================================================================== */
const WAR_MAPS={
  egypt:{name:"مصر",flag:"🇪🇬",cols:6,rows:9,regions:[
    {id:"matrouh",n:"مطروح",x:0,y:0,v:1},
    {id:"alex",n:"الإسكندرية",x:1,y:0,v:3},
    {id:"kafr",n:"كفر الشيخ",x:2,y:0,v:2},
    {id:"damietta",n:"دمياط",x:3,y:0,v:2},
    {id:"canal",n:"القناة",x:4,y:0,v:3},
    {id:"nsinai",n:"شمال سيناء",x:5,y:0,v:1},
    {id:"beheira",n:"البحيرة",x:1,y:1,v:2},
    {id:"gharbia",n:"الغربية والمنوفية",x:2,y:1,v:3},
    {id:"daqahlia",n:"الدقهلية",x:3,y:1,v:2},
    {id:"sharqia",n:"الشرقية",x:4,y:1,v:2},
    {id:"ssinai",n:"جنوب سيناء",x:5,y:1,v:1},
    {id:"cairo",n:"القاهرة الكبرى",x:3,y:2,v:4,cap:1},
    {id:"fayoum",n:"الفيوم وبني سويف",x:3,y:3,v:2},
    {id:"redsea",n:"البحر الأحمر",x:4,y:3,v:1},
    {id:"minya",n:"المنيا",x:3,y:4,v:2},
    {id:"assiut",n:"أسيوط",x:3,y:5,v:2},
    {id:"newvalley",n:"الوادي الجديد",x:2,y:5,v:1},
    {id:"sohag",n:"سوهاج",x:3,y:6,v:2},
    {id:"qena",n:"قنا والأقصر",x:3,y:7,v:2},
    {id:"aswan",n:"أسوان",x:3,y:8,v:2}
  ],links:[
    ["cairo","gharbia"],["cairo","sharqia"],["cairo","redsea"],["canal","redsea"],["ssinai","redsea"],
    ["matrouh","beheira"],["matrouh","newvalley"],["newvalley","minya"],["newvalley","sohag"],
    ["newvalley","qena"],["newvalley","aswan"],["newvalley","fayoum"],["redsea","minya"],["redsea","assiut"],
    ["redsea","sohag"],["redsea","qena"],["redsea","aswan"]
  ]},

  saudi:{name:"السعودية",flag:"🇸🇦",cols:4,rows:8,regions:[
    {id:"tabuk",n:"تبوك",x:0,y:0,v:2},
    {id:"jouf",n:"الجوف",x:1,y:0,v:1},
    {id:"north",n:"الحدود الشمالية",x:2,y:0,v:1},
    {id:"hafr",n:"حفر الباطن",x:3,y:0,v:1},
    {id:"medina",n:"المدينة المنورة",x:0,y:1,v:3},
    {id:"hail",n:"حائل",x:1,y:1,v:2},
    {id:"qassim",n:"القصيم",x:2,y:1,v:2},
    {id:"dammam",n:"الدمام",x:3,y:1,v:3},
    {id:"yanbu",n:"ينبع",x:0,y:2,v:2},
    {id:"riyadh",n:"الرياض",x:2,y:2,v:4,cap:1},
    {id:"ahsa",n:"الأحساء",x:3,y:2,v:2},
    {id:"jeddah",n:"جدة",x:0,y:3,v:3},
    {id:"kharj",n:"الخرج",x:2,y:3,v:2},
    {id:"rub",n:"الربع الخالي",x:3,y:3,v:1},
    {id:"mecca",n:"مكة المكرمة",x:0,y:4,v:3},
    {id:"taif",n:"الطائف",x:1,y:4,v:2},
    {id:"baha",n:"الباحة",x:0,y:5,v:1},
    {id:"asir",n:"عسير",x:0,y:6,v:2},
    {id:"najran",n:"نجران",x:1,y:6,v:2},
    {id:"jazan",n:"جازان",x:0,y:7,v:2}
  ],links:[
    ["yanbu","hail"],["jeddah","taif"],["medina","qassim"],["riyadh","hail"],["riyadh","taif"],
    ["taif","kharj"],["taif","baha"],["najran","kharj"],["najran","rub"],["najran","jazan"]
  ]},

  turkey:{name:"تركيا",flag:"🇹🇷",cols:6,rows:4,regions:[
    {id:"edirne",n:"إدرنة",x:0,y:0,v:1},
    {id:"istanbul",n:"إسطنبول",x:1,y:0,v:3},
    {id:"zonguldak",n:"زونغولداق",x:2,y:0,v:1},
    {id:"samsun",n:"سامسون",x:3,y:0,v:2},
    {id:"trabzon",n:"طرابزون",x:4,y:0,v:2},
    {id:"kars",n:"قارص",x:5,y:0,v:1},
    {id:"canakkale",n:"تشاناكالي",x:0,y:1,v:1},
    {id:"bursa",n:"بورصة",x:1,y:1,v:2},
    {id:"ankara",n:"أنقرة",x:2,y:1,v:4,cap:1},
    {id:"sivas",n:"سيواس",x:3,y:1,v:1},
    {id:"erzurum",n:"أرضروم",x:4,y:1,v:1},
    {id:"van",n:"وان",x:5,y:1,v:1},
    {id:"izmir",n:"إزمير",x:0,y:2,v:3},
    {id:"konya",n:"قونية",x:1,y:2,v:2},
    {id:"malatya",n:"ملاطية",x:3,y:2,v:1},
    {id:"diyarbakir",n:"ديار بكر",x:4,y:2,v:2},
    {id:"mugla",n:"موغلا",x:0,y:3,v:1},
    {id:"antalya",n:"أنطاليا",x:1,y:3,v:3},
    {id:"adana",n:"أضنة",x:2,y:3,v:2},
    {id:"gaziantep",n:"غازي عنتاب",x:3,y:3,v:2}
  ],links:[
    ["izmir","bursa"],["ankara","konya"],["ankara","adana"],["konya","adana"],
    ["adana","malatya"],["van","diyarbakir"],["istanbul","zonguldak"]
  ]},

  morocco:{name:"المغرب",flag:"🇲🇦",cols:4,rows:11,regions:[
    {id:"tangier",n:"طنجة",x:0,y:0,v:2},
    {id:"tetouan",n:"تطوان",x:1,y:0,v:1},
    {id:"hoceima",n:"الحسيمة",x:2,y:0,v:1},
    {id:"oujda",n:"وجدة",x:3,y:0,v:2},
    {id:"kenitra",n:"القنيطرة",x:0,y:1,v:1},
    {id:"meknes",n:"مكناس",x:1,y:1,v:2},
    {id:"fes",n:"فاس",x:2,y:1,v:3},
    {id:"rabat",n:"الرباط",x:0,y:2,v:4,cap:1},
    {id:"casa",n:"الدار البيضاء",x:0,y:3,v:3},
    {id:"jadida",n:"الجديدة",x:0,y:4,v:1},
    {id:"benimellal",n:"بني ملال",x:1,y:4,v:1},
    {id:"safi",n:"آسفي",x:0,y:5,v:1},
    {id:"marrakesh",n:"مراكش",x:1,y:5,v:3},
    {id:"essaouira",n:"الصويرة",x:0,y:6,v:1},
    {id:"ouarzazate",n:"ورزازات",x:1,y:6,v:1},
    {id:"errachidia",n:"الراشيدية",x:2,y:6,v:1},
    {id:"agadir",n:"أكادير",x:0,y:7,v:2},
    {id:"guelmim",n:"كلميم",x:0,y:8,v:1},
    {id:"laayoune",n:"العيون",x:0,y:9,v:2},
    {id:"dakhla",n:"الداخلة",x:0,y:10,v:1}
  ],links:[
    ["rabat","meknes"],["casa","benimellal"],["benimellal","meknes"],["benimellal","fes"],
    ["fes","oujda"],["errachidia","oujda"],["agadir","ouarzazate"],["agadir","marrakesh"]
  ]}
};
const WAR_MAP_ORDER=["egypt","saudi","turkey","morocco"];
