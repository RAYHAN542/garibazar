// থানা/উপজেলা -> জেলা ম্যাপিং। বিবরণে জেলার নাম সরাসরি না থাকলেও (যেমন "বনানী",
// "ভালুকা"), এই তালিকা দিয়ে সেই এলাকা কোন জেলার অন্তর্গত তা বের করা যায়।
// প্রতিটা এন্ট্রি: [ইংরেজি নাম, বাংলা নাম, CITIES তালিকার জেলা-কী]
// নোট: বাংলাদেশের ৬৪ জেলার আওতাধীন ~৪৯৫টি উপজেলা/থানা এবং প্রধান শহরের
// (ঢাকা, চট্টগ্রাম, খুলনা, রাজশাহী, সিলেট) থানাগুলো এখানে কভার করা হয়েছে।
// কোনো নাম ভুল/অনুপস্থিত থাকলে এই ফাইলে যোগ/সংশোধন করে নাও।

export type AreaEntry = [string, string, string];

export const AREA_TO_DISTRICT: AreaEntry[] = [
  // ===== ঢাকা জেলা: উপজেলা =====
  ["Dhamrai", "ধামরাই", "Dhaka (ঢাকা)"],
  ["Dohar", "দোহার", "Dhaka (ঢাকা)"],
  ["Keraniganj", "কেরানীগঞ্জ", "Dhaka (ঢাকা)"],
  ["Nawabganj", "নবাবগঞ্জ", "Dhaka (ঢাকা)"],
  ["Savar", "সাভার", "Dhaka (ঢাকা)"],
  // ===== ঢাকা মহানগরীর থানা/এলাকা =====
  ["Adabor", "আদাবর", "Dhaka (ঢাকা)"],
  ["Badda", "বাড্ডা", "Dhaka (ঢাকা)"],
  ["Banani", "বনানী", "Dhaka (ঢাকা)"],
  ["Baridhara", "বারিধারা", "Dhaka (ঢাকা)"],
  ["Bimanbandar", "বিমানবন্দর", "Dhaka (ঢাকা)"],
  ["Cantonment", "ক্যান্টনমেন্ট", "Dhaka (ঢাকা)"],
  ["Chawkbazar", "চকবাজার", "Dhaka (ঢাকা)"],
  ["Dakshinkhan", "দক্ষিণখান", "Dhaka (ঢাকা)"],
  ["Demra", "ডেমরা", "Dhaka (ঢাকা)"],
  ["Dhanmondi", "ধানমন্ডি", "Dhaka (ঢাকা)"],
  ["Gendaria", "গেন্ডারিয়া", "Dhaka (ঢাকা)"],
  ["Gulshan", "গুলশান", "Dhaka (ঢাকা)"],
  ["Hazaribagh", "হাজারীবাগ", "Dhaka (ঢাকা)"],
  ["Jatrabari", "যাত্রাবাড়ী", "Dhaka (ঢাকা)"],
  ["Kafrul", "কাফরুল", "Dhaka (ঢাকা)"],
  ["Kalabagan", "কলাবাগান", "Dhaka (ঢাকা)"],
  ["Kamrangirchar", "কামরাঙ্গীরচর", "Dhaka (ঢাকা)"],
  ["Khilgaon", "খিলগাঁও", "Dhaka (ঢাকা)"],
  ["Khilkhet", "খিলক্ষেত", "Dhaka (ঢাকা)"],
  ["Kotwali", "কোতোয়ালি", "Dhaka (ঢাকা)"],
  ["Lalbagh", "লালবাগ", "Dhaka (ঢাকা)"],
  ["Mirpur", "মিরপুর", "Dhaka (ঢাকা)"],
  ["Mohammadpur", "মোহাম্মদপুর", "Dhaka (ঢাকা)"],
  ["Motijheel", "মতিঝিল", "Dhaka (ঢাকা)"],
  ["Mugda", "মুগদা", "Dhaka (ঢাকা)"],
  ["New Market", "নিউমার্কেট", "Dhaka (ঢাকা)"],
  ["Pallabi", "পল্লবী", "Dhaka (ঢাকা)"],
  ["Paltan", "পল্টন", "Dhaka (ঢাকা)"],
  ["Ramna", "রমনা", "Dhaka (ঢাকা)"],
  ["Rampura", "রামপুরা", "Dhaka (ঢাকা)"],
  ["Sabujbagh", "সবুজবাগ", "Dhaka (ঢাকা)"],
  ["Shah Ali", "শাহ আলী", "Dhaka (ঢাকা)"],
  ["Shahbagh", "শাহবাগ", "Dhaka (ঢাকা)"],
  ["Sher-e-Bangla Nagar", "শেরে বাংলা নগর", "Dhaka (ঢাকা)"],
  ["Shyampur", "শ্যামপুর", "Dhaka (ঢাকা)"],
  ["Sutrapur", "সূত্রাপুর", "Dhaka (ঢাকা)"],
  ["Tejgaon", "তেজগাঁও", "Dhaka (ঢাকা)"],
  ["Turag", "তুরাগ", "Dhaka (ঢাকা)"],
  ["Uttara", "উত্তরা", "Dhaka (ঢাকা)"],
  ["Uttarkhan", "উত্তরখান", "Dhaka (ঢাকা)"],
  ["Vatara", "ভাটারা", "Dhaka (ঢাকা)"],
  ["Wari", "ওয়ারী", "Dhaka (ঢাকা)"],
  ["Bashundhara", "বসুন্ধরা", "Dhaka (ঢাকা)"],
  ["Malibagh", "মালিবাগ", "Dhaka (ঢাকা)"],
  ["Farmgate", "ফার্মগেট", "Dhaka (ঢাকা)"],
  ["Elephant Road", "এলিফ্যান্ট রোড", "Dhaka (ঢাকা)"],
  ["Shyamoli", "শ্যামলী", "Dhaka (ঢাকা)"],
  ["Mohakhali", "মহাখালী", "Dhaka (ঢাকা)"],
  ["Uttar Badda", "উত্তর বাড্ডা", "Dhaka (ঢাকা)"],

  // ===== ফরিদপুর =====
  ["Alfadanga", "আলফাডাঙ্গা", "Faridpur (ফরিদপুর)"],
  ["Bhanga", "ভাঙ্গা", "Faridpur (ফরিদপুর)"],
  ["Boalmari", "বোয়ালমারী", "Faridpur (ফরিদপুর)"],
  ["Charbhadrasan", "চরভদ্রাসন", "Faridpur (ফরিদপুর)"],
  ["Madhukhali", "মধুখালী", "Faridpur (ফরিদপুর)"],
  ["Nagarkanda", "নগরকান্দা", "Faridpur (ফরিদপুর)"],
  ["Sadarpur", "সদরপুর", "Faridpur (ফরিদপুর)"],
  ["Saltha", "সালথা", "Faridpur (ফরিদপুর)"],

  // ===== গাজীপুর =====
  ["Kaliakair", "কালিয়াকৈর", "Gazipur (গাজীপুর)"],
  ["Kaliganj", "কালীগঞ্জ", "Gazipur (গাজীপুর)"],
  ["Kapasia", "কাপাসিয়া", "Gazipur (গাজীপুর)"],
  ["Sreepur", "শ্রীপুর", "Gazipur (গাজীপুর)"],
  ["Tongi", "টঙ্গী", "Gazipur (গাজীপুর)"],

  // ===== নারায়ণগঞ্জ =====
  ["Araihazar", "আড়াইহাজার", "Narayanganj (নারায়ণগঞ্জ)"],
  ["Bandar", "বন্দর", "Narayanganj (নারায়ণগঞ্জ)"],
  ["Rupganj", "রূপগঞ্জ", "Narayanganj (নারায়ণগঞ্জ)"],
  ["Sonargaon", "সোনারগাঁও", "Narayanganj (নারায়ণগঞ্জ)"],
  ["Fatullah", "ফতুল্লা", "Narayanganj (নারায়ণগঞ্জ)"],
  ["Siddhirganj", "সিদ্ধিরগঞ্জ", "Narayanganj (নারায়ণগঞ্জ)"],

  // ===== কুমিল্লা =====
  ["Barura", "বরুড়া", "Comilla (কুমিল্লা)"],
  ["Brahmanpara", "ব্রাহ্মণপাড়া", "Comilla (কুমিল্লা)"],
  ["Burichang", "বুড়িচং", "Comilla (কুমিল্লা)"],
  ["Chandina", "চান্দিনা", "Comilla (কুমিল্লা)"],
  ["Chauddagram", "চৌদ্দগ্রাম", "Comilla (কুমিল্লা)"],
  ["Daudkandi", "দাউদকান্দি", "Comilla (কুমিল্লা)"],
  ["Debidwar", "দেবিদ্বার", "Comilla (কুমিল্লা)"],
  ["Homna", "হোমনা", "Comilla (কুমিল্লা)"],
  ["Laksam", "লাকসাম", "Comilla (কুমিল্লা)"],
  ["Muradnagar", "মুরাদনগর", "Comilla (কুমিল্লা)"],
  ["Nangalkot", "নাঙ্গলকোট", "Comilla (কুমিল্লা)"],
  ["Meghna", "মেঘনা", "Comilla (কুমিল্লা)"],
  ["Titas", "তিতাস", "Comilla (কুমিল্লা)"],
  ["Monohorgonj", "মনোহরগঞ্জ", "Comilla (কুমিল্লা)"],

  // ===== ফেনী =====
  ["Chhagalnaiya", "ছাগলনাইয়া", "Feni (ফেনী)"],
  ["Daganbhuiyan", "দাগনভূঞা", "Feni (ফেনী)"],
  ["Fulgazi", "ফুলগাজী", "Feni (ফেনী)"],
  ["Parshuram", "পরশুরাম", "Feni (ফেনী)"],
  ["Sonagazi", "সোনাগাজী", "Feni (ফেনী)"],

  // ===== ব্রাহ্মণবাড়িয়া =====
  ["Akhaura", "আখাউড়া", "Brahmanbaria (ব্রাহ্মণবাড়িয়া)"],
  ["Bancharampur", "বাঞ্ছারামপুর", "Brahmanbaria (ব্রাহ্মণবাড়িয়া)"],
  ["Kasba", "কসবা", "Brahmanbaria (ব্রাহ্মণবাড়িয়া)"],
  ["Nabinagar", "নবীনগর", "Brahmanbaria (ব্রাহ্মণবাড়িয়া)"],
  ["Nasirnagar", "নাসিরনগর", "Brahmanbaria (ব্রাহ্মণবাড়িয়া)"],
  ["Sarail", "সরাইল", "Brahmanbaria (ব্রাহ্মণবাড়িয়া)"],
  ["Ashuganj", "আশুগঞ্জ", "Brahmanbaria (ব্রাহ্মণবাড়িয়া)"],
  ["Bijoynagar", "বিজয়নগর", "Brahmanbaria (ব্রাহ্মণবাড়িয়া)"],

  // ===== রাঙ্গামাটি =====
  ["Bagaichhari", "বাঘাইছড়ি", "Rangamati (রাঙ্গামাটি)"],
  ["Barkal", "বরকল", "Rangamati (রাঙ্গামাটি)"],
  ["Belaichhari", "বিলাইছড়ি", "Rangamati (রাঙ্গামাটি)"],
  ["Juraichhari", "জুরাছড়ি", "Rangamati (রাঙ্গামাটি)"],
  ["Kaptai", "কাপ্তাই", "Rangamati (রাঙ্গামাটি)"],
  ["Kawkhali", "কাউখালী", "Rangamati (রাঙ্গামাটি)"],
  ["Langadu", "লংগদু", "Rangamati (রাঙ্গামাটি)"],
  ["Naniarchar", "নানিয়ারচর", "Rangamati (রাঙ্গামাটি)"],
  ["Rajasthali", "রাজস্থলী", "Rangamati (রাঙ্গামাটি)"],

  // ===== নোয়াখালী =====
  ["Begumganj", "বেগমগঞ্জ", "Noakhali (নোয়াখালী)"],
  ["Chatkhil", "চাটখিল", "Noakhali (নোয়াখালী)"],
  ["Companiganj", "কোম্পানীগঞ্জ", "Noakhali (নোয়াখালী)"],
  ["Hatiya", "হাতিয়া", "Noakhali (নোয়াখালী)"],
  ["Kabirhat", "কবিরহাট", "Noakhali (নোয়াখালী)"],
  ["Senbagh", "সেনবাগ", "Noakhali (নোয়াখালী)"],
  ["Subarnachar", "সুবর্ণচর", "Noakhali (নোয়াখালী)"],
  ["Sudharam", "সুধারাম", "Noakhali (নোয়াখালী)"],
  ["Maijdee", "মাইজদী", "Noakhali (নোয়াখালী)"],

  // ===== চাঁদপুর =====
  ["Faridganj", "ফরিদগঞ্জ", "Chandpur (চাঁদপুর)"],
  ["Haimchar", "হাইমচর", "Chandpur (চাঁদপুর)"],
  ["Haziganj", "হাজীগঞ্জ", "Chandpur (চাঁদপুর)"],
  ["Kachua", "কচুয়া", "Chandpur (চাঁদপুর)"],
  ["Matlab Dakshin", "মতলব দক্ষিণ", "Chandpur (চাঁদপুর)"],
  ["Matlab Uttar", "মতলব উত্তর", "Chandpur (চাঁদপুর)"],
  ["Shahrasti", "শাহরাস্তি", "Chandpur (চাঁদপুর)"],

  // ===== লক্ষ্মীপুর =====
  ["Kamalnagar", "কমলনগর", "Lakshmipur (লক্ষ্মীপুর)"],
  ["Raipur", "রায়পুর", "Lakshmipur (লক্ষ্মীপুর)"],
  ["Ramganj", "রামগঞ্জ", "Lakshmipur (লক্ষ্মীপুর)"],
  ["Ramgati", "রামগতি", "Lakshmipur (লক্ষ্মীপুর)"],

  // ===== কক্সবাজার =====
  ["Chakaria", "চকরিয়া", "Cox's Bazar (কক্সবাজার)"],
  ["Kutubdia", "কুতুবদিয়া", "Cox's Bazar (কক্সবাজার)"],
  ["Maheshkhali", "মহেশখালী", "Cox's Bazar (কক্সবাজার)"],
  ["Pekua", "পেকুয়া", "Cox's Bazar (কক্সবাজার)"],
  ["Ramu", "রামু", "Cox's Bazar (কক্সবাজার)"],
  ["Teknaf", "টেকনাফ", "Cox's Bazar (কক্সবাজার)"],
  ["Ukhia", "উখিয়া", "Cox's Bazar (কক্সবাজার)"],
  ["Inani", "ইনানী", "Cox's Bazar (কক্সবাজার)"],

  // ===== বান্দরবান =====
  ["Ali Kadam", "আলীকদম", "Bandarban (বান্দরবান)"],
  ["Lama", "লামা", "Bandarban (বান্দরবান)"],
  ["Naikhongchhari", "নাইক্ষ্যংছড়ি", "Bandarban (বান্দরবান)"],
  ["Rowangchhari", "রোয়াংছড়ি", "Bandarban (বান্দরবান)"],
  ["Ruma", "রুমা", "Bandarban (বান্দরবান)"],
  ["Thanchi", "থানচি", "Bandarban (বান্দরবান)"],

  // ===== খাগড়াছড়ি =====
  ["Dighinala", "দীঘিনালা", "Khagrachhari (খাগড়াছড়ি)"],
  ["Lakshmichhari", "লক্ষ্মীছড়ি", "Khagrachhari (খাগড়াছড়ি)"],
  ["Mahalchhari", "মহালছড়ি", "Khagrachhari (খাগড়াছড়ি)"],
  ["Manikchhari", "মানিকছড়ি", "Khagrachhari (খাগড়াছড়ি)"],
  ["Matiranga", "মাটিরাঙ্গা", "Khagrachhari (খাগড়াছড়ি)"],
  ["Panchhari", "পানছড়ি", "Khagrachhari (খাগড়াছড়ি)"],
  ["Ramgarh", "রামগড়", "Khagrachhari (খাগড়াছড়ি)"],

  // ===== চট্টগ্রাম (জেলা + মহানগর) =====
  ["Anwara", "আনোয়ারা", "Chittagong (চট্টগ্রাম)"],
  ["Banshkhali", "বাঁশখালী", "Chittagong (চট্টগ্রাম)"],
  ["Boalkhali", "বোয়ালখালী", "Chittagong (চট্টগ্রাম)"],
  ["Chandanaish", "চন্দনাইশ", "Chittagong (চট্টগ্রাম)"],
  ["Fatikchhari", "ফটিকছড়ি", "Chittagong (চট্টগ্রাম)"],
  ["Hathazari", "হাটহাজারী", "Chittagong (চট্টগ্রাম)"],
  ["Lohagara", "লোহাগাড়া", "Chittagong (চট্টগ্রাম)"],
  ["Mirsharai", "মীরসরাই", "Chittagong (চট্টগ্রাম)"],
  ["Patiya", "পটিয়া", "Chittagong (চট্টগ্রাম)"],
  ["Rangunia", "রাঙ্গুনিয়া", "Chittagong (চট্টগ্রাম)"],
  ["Raozan", "রাউজান", "Chittagong (চট্টগ্রাম)"],
  ["Sandwip", "সন্দ্বীপ", "Chittagong (চট্টগ্রাম)"],
  ["Satkania", "সাতকানিয়া", "Chittagong (চট্টগ্রাম)"],
  ["Sitakunda", "সীতাকুণ্ড", "Chittagong (চট্টগ্রাম)"],
  ["Panchlaish", "পাঁচলাইশ", "Chittagong (চট্টগ্রাম)"],
  ["Double Mooring", "ডবলমুরিং", "Chittagong (চট্টগ্রাম)"],
  ["Pahartali", "পাহাড়তলী", "Chittagong (চট্টগ্রাম)"],
  ["Chandgaon", "চান্দগাঁও", "Chittagong (চট্টগ্রাম)"],
  ["Bakalia", "বাকলিয়া", "Chittagong (চট্টগ্রাম)"],
  ["Halishahar", "হালিশহর", "Chittagong (চট্টগ্রাম)"],
  ["Khulshi", "খুলশী", "Chittagong (চট্টগ্রাম)"],
  ["Bayazid Bostami", "বায়েজিদ বোস্তামী", "Chittagong (চট্টগ্রাম)"],
  ["Agrabad", "আগ্রাবাদ", "Chittagong (চট্টগ্রাম)"],
  ["GEC", "জিইসি", "Chittagong (চট্টগ্রাম)"],
  ["Nasirabad", "নাসিরাবাদ", "Chittagong (চট্টগ্রাম)"],
  ["Patenga", "পতেঙ্গা", "Chittagong (চট্টগ্রাম)"],

  // ===== রাজশাহী =====
  ["Bagha", "বাঘা", "Rajshahi (রাজশাহী)"],
  ["Bagmara", "বাগমারা", "Rajshahi (রাজশাহী)"],
  ["Charghat", "চারঘাট", "Rajshahi (রাজশাহী)"],
  ["Durgapur", "দুর্গাপুর", "Rajshahi (রাজশাহী)"],
  ["Godagari", "গোদাগাড়ী", "Rajshahi (রাজশাহী)"],
  ["Mohanpur", "মোহনপুর", "Rajshahi (রাজশাহী)"],
  ["Paba", "পবা", "Rajshahi (রাজশাহী)"],
  ["Puthia", "পুঠিয়া", "Rajshahi (রাজশাহী)"],
  ["Tanore", "তানোর", "Rajshahi (রাজশাহী)"],
  ["Boalia", "বোয়ালিয়া", "Rajshahi (রাজশাহী)"],
  ["Motihar", "মতিহার", "Rajshahi (রাজশাহী)"],
  ["Shah Makhdum", "শাহ মখদুম", "Rajshahi (রাজশাহী)"],
  ["Rajpara", "রাজপাড়া", "Rajshahi (রাজশাহী)"],

  // ===== বগুড়া =====
  ["Adamdighi", "আদমদীঘি", "Bogra (বগুড়া)"],
  ["Dhunat", "ধুনট", "Bogra (বগুড়া)"],
  ["Dhupchanchia", "দুপচাঁচিয়া", "Bogra (বগুড়া)"],
  ["Gabtali", "গাবতলী", "Bogra (বগুড়া)"],
  ["Kahaloo", "কাহালু", "Bogra (বগুড়া)"],
  ["Nandigram", "নন্দীগ্রাম", "Bogra (বগুড়া)"],
  ["Sariakandi", "সারিয়াকান্দি", "Bogra (বগুড়া)"],
  ["Shajahanpur", "শাজাহানপুর", "Bogra (বগুড়া)"],
  ["Sherpur", "শেরপুর", "Bogra (বগুড়া)"],
  ["Shibganj", "শিবগঞ্জ", "Bogra (বগুড়া)"],
  ["Sonatola", "সোনাতলা", "Bogra (বগুড়া)"],

  // ===== জয়পুরহাট =====
  ["Akkelpur", "আক্কেলপুর", "Joypurhat (জয়পুরহাট)"],
  ["Kalai", "কালাই", "Joypurhat (জয়পুরহাট)"],
  ["Khetlal", "ক্ষেতলাল", "Joypurhat (জয়পুরহাট)"],
  ["Panchbibi", "পাঁচবিবি", "Joypurhat (জয়পুরহাট)"],

  // ===== নওগাঁ =====
  ["Atrai", "আত্রাই", "Naogaon (নওগাঁ)"],
  ["Badalgachhi", "বদলগাছী", "Naogaon (নওগাঁ)"],
  ["Dhamoirhat", "ধামইরহাট", "Naogaon (নওগাঁ)"],
  ["Manda", "মান্দা", "Naogaon (নওগাঁ)"],
  ["Mahadevpur", "মহাদেবপুর", "Naogaon (নওগাঁ)"],
  ["Niamatpur", "নিয়ামতপুর", "Naogaon (নওগাঁ)"],
  ["Patnitala", "পত্নীতলা", "Naogaon (নওগাঁ)"],
  ["Porsha", "পোরশা", "Naogaon (নওগাঁ)"],
  ["Raninagar", "রাণীনগর", "Naogaon (নওগাঁ)"],
  ["Sapahar", "সাপাহার", "Naogaon (নওগাঁ)"],

  // ===== নাটোর =====
  ["Bagatipara", "বাগাতিপাড়া", "Natore (নাটোর)"],
  ["Baraigram", "বড়াইগ্রাম", "Natore (নাটোর)"],
  ["Gurudaspur", "গুরুদাসপুর", "Natore (নাটোর)"],
  ["Lalpur", "লালপুর", "Natore (নাটোর)"],
  ["Naldanga", "নলডাঙ্গা", "Natore (নাটোর)"],
  ["Singra", "সিংড়া", "Natore (নাটোর)"],

  // ===== চাঁপাইনবাবগঞ্জ =====
  ["Bholahat", "ভোলাহাট", "Chapainawabganj (চাঁপাইনবাবগঞ্জ)"],
  ["Gomastapur", "গোমস্তাপুর", "Chapainawabganj (চাঁপাইনবাবগঞ্জ)"],
  ["Nachole", "নাচোল", "Chapainawabganj (চাঁপাইনবাবগঞ্জ)"],
  ["Shibganj Chapai", "শিবগঞ্জ", "Chapainawabganj (চাঁপাইনবাবগঞ্জ)"],

  // ===== পাবনা =====
  ["Atgharia", "আটঘরিয়া", "Pabna (পাবনা)"],
  ["Bera", "বেড়া", "Pabna (পাবনা)"],
  ["Bhangura", "ভাঙ্গুড়া", "Pabna (পাবনা)"],
  ["Chatmohar", "চাটমোহর", "Pabna (পাবনা)"],
  ["Ishwardi", "ঈশ্বরদী", "Pabna (পাবনা)"],
  ["Santhia", "সাঁথিয়া", "Pabna (পাবনা)"],
  ["Sujanagar", "সুজানগর", "Pabna (পাবনা)"],

  // ===== সিরাজগঞ্জ =====
  ["Belkuchi", "বেলকুচি", "Sirajganj (সিরাজগঞ্জ)"],
  ["Chauhali", "চৌহালী", "Sirajganj (সিরাজগঞ্জ)"],
  ["Kamarkhanda", "কামারখন্দ", "Sirajganj (সিরাজগঞ্জ)"],
  ["Kazipur", "কাজীপুর", "Sirajganj (সিরাজগঞ্জ)"],
  ["Raiganj", "রায়গঞ্জ", "Sirajganj (সিরাজগঞ্জ)"],
  ["Shahjadpur", "শাহজাদপুর", "Sirajganj (সিরাজগঞ্জ)"],
  ["Tarash", "তাড়াশ", "Sirajganj (সিরাজগঞ্জ)"],
  ["Ullapara", "উল্লাপাড়া", "Sirajganj (সিরাজগঞ্জ)"],

  // ===== দিনাজপুর =====
  ["Birampur", "বিরামপুর", "Dinajpur (দিনাজপুর)"],
  ["Birganj", "বীরগঞ্জ", "Dinajpur (দিনাজপুর)"],
  ["Biral", "বিরল", "Dinajpur (দিনাজপুর)"],
  ["Bochaganj", "বোচাগঞ্জ", "Dinajpur (দিনাজপুর)"],
  ["Chirirbandar", "চিরিরবন্দর", "Dinajpur (দিনাজপুর)"],
  ["Fulbari Dinajpur", "ফুলবাড়ী", "Dinajpur (দিনাজপুর)"],
  ["Ghoraghat", "ঘোড়াঘাট", "Dinajpur (দিনাজপুর)"],
  ["Hakimpur", "হাকিমপুর", "Dinajpur (দিনাজপুর)"],
  ["Kaharole", "খানসামা", "Dinajpur (দিনাজপুর)"],
  ["Parbatipur", "পার্বতীপুর", "Dinajpur (দিনাজপুর)"],

  // ===== গাইবান্ধা =====
  ["Fulchhari", "ফুলছড়ি", "Gaibandha (গাইবান্ধা)"],
  ["Gobindaganj", "গোবিন্দগঞ্জ", "Gaibandha (গাইবান্ধা)"],
  ["Palashbari", "পলাশবাড়ী", "Gaibandha (গাইবান্ধা)"],
  ["Sadullapur", "সাদুল্লাপুর", "Gaibandha (গাইবান্ধা)"],
  ["Saghata", "সাঘাটা", "Gaibandha (গাইবান্ধা)"],
  ["Sundarganj", "সুন্দরগঞ্জ", "Gaibandha (গাইবান্ধা)"],

  // ===== কুড়িগ্রাম =====
  ["Bhurungamari", "ভুরুঙ্গামারী", "Kurigram (কুড়িগ্রাম)"],
  ["Char Rajibpur", "চর রাজিবপুর", "Kurigram (কুড়িগ্রাম)"],
  ["Chilmari", "চিলমারী", "Kurigram (কুড়িগ্রাম)"],
  ["Nageshwari", "নাগেশ্বরী", "Kurigram (কুড়িগ্রাম)"],
  ["Phulbari Kurigram", "ফুলবাড়ী", "Kurigram (কুড়িগ্রাম)"],
  ["Rajarhat", "রাজারহাট", "Kurigram (কুড়িগ্রাম)"],
  ["Raomari", "রৌমারী", "Kurigram (কুড়িগ্রাম)"],
  ["Ulipur", "উলিপুর", "Kurigram (কুড়িগ্রাম)"],

  // ===== লালমনিরহাট =====
  ["Aditmari", "আদিতমারী", "Lalmonirhat (লালমনিরহাট)"],
  ["Hatibandha", "হাতীবান্ধা", "Lalmonirhat (লালমনিরহাট)"],
  ["Patgram", "পাটগ্রাম", "Lalmonirhat (লালমনিরহাট)"],

  // ===== নীলফামারী =====
  ["Dimla", "ডিমলা", "Nilphamari (নীলফামারী)"],
  ["Domar", "ডোমার", "Nilphamari (নীলফামারী)"],
  ["Jaldhaka", "জলঢাকা", "Nilphamari (নীলফামারী)"],
  ["Saidpur", "সৈয়দপুর", "Nilphamari (নীলফামারী)"],

  // ===== পঞ্চগড় =====
  ["Atwari", "আটোয়ারী", "Panchagarh (পঞ্চগড়)"],
  ["Boda", "বোদা", "Panchagarh (পঞ্চগড়)"],
  ["Debiganj", "দেবীগঞ্জ", "Panchagarh (পঞ্চগড়)"],
  ["Tetulia", "তেঁতুলিয়া", "Panchagarh (পঞ্চগড়)"],

  // ===== ঠাকুরগাঁও =====
  ["Baliadangi", "বালিয়াডাঙ্গী", "Thakurgaon (ঠাকুরগাঁও)"],
  ["Haripur", "হরিপুর", "Thakurgaon (ঠাকুরগাঁও)"],
  ["Ranisankail", "রাণীশংকৈল", "Thakurgaon (ঠাকুরগাঁও)"],

  // ===== রংপুর =====
  ["Badarganj", "বদরগঞ্জ", "Rangpur (রংপুর)"],
  ["Gangachara", "গংগাচড়া", "Rangpur (রংপুর)"],
  ["Kaunia", "কাউনিয়া", "Rangpur (রংপুর)"],
  ["Mithapukur", "মিঠাপুকুর", "Rangpur (রংপুর)"],
  ["Pirgacha", "পীরগাছা", "Rangpur (রংপুর)"],
  ["Pirganj Rangpur", "পীরগঞ্জ", "Rangpur (রংপুর)"],
  ["Taraganj", "তারাগঞ্জ", "Rangpur (রংপুর)"],

  // ===== যশোর =====
  ["Abhaynagar", "অভয়নগর", "Jessore (যশোর)"],
  ["Bagherpara", "বাঘারপাড়া", "Jessore (যশোর)"],
  ["Chaugachha", "চৌগাছা", "Jessore (যশোর)"],
  ["Jhikargachha", "ঝিকরগাছা", "Jessore (যশোর)"],
  ["Keshabpur", "কেশবপুর", "Jessore (যশোর)"],
  ["Manirampur", "মণিরামপুর", "Jessore (যশোর)"],
  ["Sharsha", "শার্শা", "Jessore (যশোর)"],
  ["Benapole", "বেনাপোল", "Jessore (যশোর)"],

  // ===== সাতক্ষীরা =====
  ["Assasuni", "আশাশুনি", "Satkhira (সাতক্ষীরা)"],
  ["Debhata", "দেবহাটা", "Satkhira (সাতক্ষীরা)"],
  ["Kalaroa", "কলারোয়া", "Satkhira (সাতক্ষীরা)"],
  ["Satkhira Kaliganj", "কালীগঞ্জ", "Satkhira (সাতক্ষীরা)"],
  ["Shyamnagar", "শ্যামনগর", "Satkhira (সাতক্ষীরা)"],
  ["Tala", "তালা", "Satkhira (সাতক্ষীরা)"],

  // ===== মেহেরপুর =====
  ["Gangni", "গাংনী", "Meherpur (মেহেরপুর)"],
  ["Mujibnagar", "মুজিবনগর", "Meherpur (মেহেরপুর)"],

  // ===== নড়াইল =====
  ["Kalia", "কালিয়া", "Narail (নড়াইল)"],
  ["Lohagara Narail", "লোহাগড়া", "Narail (নড়াইল)"],

  // ===== চুয়াডাঙ্গা =====
  ["Alamdanga", "আলমডাঙ্গা", "Chuadanga (চুয়াডাঙ্গা)"],
  ["Damurhuda", "দামুড়হুদা", "Chuadanga (চুয়াডাঙ্গা)"],
  ["Jibannagar", "জীবননগর", "Chuadanga (চুয়াডাঙ্গা)"],

  // ===== কুষ্টিয়া =====
  ["Bheramara", "ভেড়ামারা", "Kushtia (কুষ্টিয়া)"],
  ["Daulatpur Kushtia", "দৌলতপুর", "Kushtia (কুষ্টিয়া)"],
  ["Khoksa", "খোকসা", "Kushtia (কুষ্টিয়া)"],
  ["Kumarkhali", "কুমারখালী", "Kushtia (কুষ্টিয়া)"],
  ["Mirpur Kushtia", "মিরপুর", "Kushtia (কুষ্টিয়া)"],

  // ===== মাগুরা =====
  ["Mohammadpur Magura", "মহম্মদপুর", "Magura (মাগুরা)"],
  ["Shalikha", "শালিখা", "Magura (মাগুরা)"],
  ["Sreepur Magura", "শ্রীপুর", "Magura (মাগুরা)"],

  // ===== বাগেরহাট =====
  ["Chitalmari", "চিতলমারী", "Bagerhat (বাগেরহাট)"],
  ["Fakirhat", "ফকিরহাট", "Bagerhat (বাগেরহাট)"],
  ["Kachua Bagerhat", "কচুয়া", "Bagerhat (বাগেরহাট)"],
  ["Mollahat", "মোল্লাহাট", "Bagerhat (বাগেরহাট)"],
  ["Mongla", "মংলা", "Bagerhat (বাগেরহাট)"],
  ["Morrelganj", "মোরেলগঞ্জ", "Bagerhat (বাগেরহাট)"],
  ["Rampal", "রামপাল", "Bagerhat (বাগেরহাট)"],
  ["Sarankhola", "শরণখোলা", "Bagerhat (বাগেরহাট)"],

  // ===== ঝিনাইদহ =====
  ["Harinakunda", "হরিণাকুণ্ডু", "Jhenaidah (ঝিনাইদহ)"],
  ["Jhenaidah Kaliganj", "কালীগঞ্জ", "Jhenaidah (ঝিনাইদহ)"],
  ["Kotchandpur", "কোটচাঁদপুর", "Jhenaidah (ঝিনাইদহ)"],
  ["Maheshpur", "মহেশপুর", "Jhenaidah (ঝিনাইদহ)"],
  ["Shailkupa", "শৈলকুপা", "Jhenaidah (ঝিনাইদহ)"],

  // ===== খুলনা =====
  ["Batiaghata", "বটিয়াঘাটা", "Khulna (খুলনা)"],
  ["Dacope", "দাকোপ", "Khulna (খুলনা)"],
  ["Dumuria", "ডুমুরিয়া", "Khulna (খুলনা)"],
  ["Dighalia", "দিঘলিয়া", "Khulna (খুলনা)"],
  ["Koyra", "কয়রা", "Khulna (খুলনা)"],
  ["Paikgachha", "পাইকগাছা", "Khulna (খুলনা)"],
  ["Phultala", "ফুলতলা", "Khulna (খুলনা)"],
  ["Rupsa", "রূপসা", "Khulna (খুলনা)"],
  ["Terokhada", "তেরখাদা", "Khulna (খুলনা)"],
  ["Sonadanga", "সোনাডাঙ্গা", "Khulna (খুলনা)"],
  ["Khalishpur", "খালিশপুর", "Khulna (খুলনা)"],
  ["Daulatpur Khulna", "দৌলতপুর", "Khulna (খুলনা)"],
  ["Khan Jahan Ali", "খানজাহান আলী", "Khulna (খুলনা)"],

  // ===== বরগুনা =====
  ["Amtali", "আমতলী", "Barguna (বরগুনা)"],
  ["Bamna", "বামনা", "Barguna (বরগুনা)"],
  ["Betagi", "বেতাগী", "Barguna (বরগুনা)"],
  ["Patharghata", "পাথরঘাটা", "Barguna (বরগুনা)"],
  ["Taltali", "তালতলী", "Barguna (বরগুনা)"],

  // ===== বরিশাল =====
  ["Agailjhara", "আগৈলঝাড়া", "Barisal (বরিশাল)"],
  ["Babuganj", "বাবুগঞ্জ", "Barisal (বরিশাল)"],
  ["Bakerganj", "বাকেরগঞ্জ", "Barisal (বরিশাল)"],
  ["Banaripara", "বানারীপাড়া", "Barisal (বরিশাল)"],
  ["Gaurnadi", "গৌরনদী", "Barisal (বরিশাল)"],
  ["Hizla", "হিজলা", "Barisal (বরিশাল)"],
  ["Mehendiganj", "মেহেন্দিগঞ্জ", "Barisal (বরিশাল)"],
  ["Muladi", "মুলাদী", "Barisal (বরিশাল)"],
  ["Wazirpur", "উজিরপুর", "Barisal (বরিশাল)"],

  // ===== ভোলা =====
  ["Burhanuddin", "বোরহানউদ্দিন", "Bhola (ভোলা)"],
  ["Char Fasson", "চরফ্যাশন", "Bhola (ভোলা)"],
  ["Daulatkhan", "দৌলতখান", "Bhola (ভোলা)"],
  ["Lalmohan", "লালমোহন", "Bhola (ভোলা)"],
  ["Manpura", "মনপুরা", "Bhola (ভোলা)"],
  ["Tazumuddin", "তজুমদ্দিন", "Bhola (ভোলা)"],

  // ===== ঝালকাঠি =====
  ["Kathalia", "কাঠালিয়া", "Jhalokati (ঝালকাঠি)"],
  ["Nalchity", "নলছিটি", "Jhalokati (ঝালকাঠি)"],
  ["Rajapur Jhalokati", "রাজাপুর", "Jhalokati (ঝালকাঠি)"],

  // ===== পটুয়াখালী =====
  ["Bauphal", "বাউফল", "Patuakhali (পটুয়াখালী)"],
  ["Dashmina", "দশমিনা", "Patuakhali (পটুয়াখালী)"],
  ["Dumki", "দুমকি", "Patuakhali (পটুয়াখালী)"],
  ["Galachipa", "গলাচিপা", "Patuakhali (পটুয়াখালী)"],
  ["Kalapara", "কলাপাড়া", "Patuakhali (পটুয়াখালী)"],
  ["Mirzaganj", "মির্জাগঞ্জ", "Patuakhali (পটুয়াখালী)"],
  ["Rangabali", "রাঙ্গাবালী", "Patuakhali (পটুয়াখালী)"],
  ["Kuakata", "কুয়াকাটা", "Patuakhali (পটুয়াখালী)"],

  // ===== পিরোজপুর =====
  ["Bhandaria", "ভান্ডারিয়া", "Pirojpur (পিরোজপুর)"],
  ["Mathbaria", "মঠবাড়িয়া", "Pirojpur (পিরোজপুর)"],
  ["Nazirpur", "নাজিরপুর", "Pirojpur (পিরোজপুর)"],
  ["Nesarabad", "নেছারাবাদ", "Pirojpur (পিরোজপুর)"],
  ["Zianagar", "জিয়ানগর", "Pirojpur (পিরোজপুর)"],

  // ===== হবিগঞ্জ =====
  ["Ajmiriganj", "আজমিরীগঞ্জ", "Habiganj (হবিগঞ্জ)"],
  ["Bahubal", "বাহুবল", "Habiganj (হবিগঞ্জ)"],
  ["Baniyachong", "বানিয়াচং", "Habiganj (হবিগঞ্জ)"],
  ["Chunarughat", "চুনারুঘাট", "Habiganj (হবিগঞ্জ)"],
  ["Lakhai", "লাখাই", "Habiganj (হবিগঞ্জ)"],
  ["Madhabpur", "মাধবপুর", "Habiganj (হবিগঞ্জ)"],
  ["Nabiganj", "নবীগঞ্জ", "Habiganj (হবিগঞ্জ)"],
  ["Shayestaganj", "শায়েস্তাগঞ্জ", "Habiganj (হবিগঞ্জ)"],

  // ===== মৌলভীবাজার =====
  ["Barlekha", "বড়লেখা", "Moulvibazar (মৌলভীবাজার)"],
  ["Juri", "জুড়ী", "Moulvibazar (মৌলভীবাজার)"],
  ["Kamalganj", "কমলগঞ্জ", "Moulvibazar (মৌলভীবাজার)"],
  ["Kulaura", "কুলাউড়া", "Moulvibazar (মৌলভীবাজার)"],
  ["Rajnagar", "রাজনগর", "Moulvibazar (মৌলভীবাজার)"],
  ["Sreemangal", "শ্রীমঙ্গল", "Moulvibazar (মৌলভীবাজার)"],

  // ===== সুনামগঞ্জ =====
  ["Bishwamvarpur", "বিশ্বম্ভরপুর", "Sunamganj (সুনামগঞ্জ)"],
  ["Chhatak", "ছাতক", "Sunamganj (সুনামগঞ্জ)"],
  ["Derai", "দিরাই", "Sunamganj (সুনামগঞ্জ)"],
  ["Dharampasha", "ধর্মপাশা", "Sunamganj (সুনামগঞ্জ)"],
  ["Dowarabazar", "দোয়ারাবাজার", "Sunamganj (সুনামগঞ্জ)"],
  ["Jagannathpur", "জগন্নাথপুর", "Sunamganj (সুনামগঞ্জ)"],
  ["Jamalganj", "জামালগঞ্জ", "Sunamganj (সুনামগঞ্জ)"],
  ["Sullah", "শাল্লা", "Sunamganj (সুনামগঞ্জ)"],
  ["Tahirpur", "তাহিরপুর", "Sunamganj (সুনামগঞ্জ)"],
  ["Shantiganj", "শান্তিগঞ্জ", "Sunamganj (সুনামগঞ্জ)"],

  // ===== সিলেট =====
  ["Balaganj", "বালাগঞ্জ", "Sylhet (সিলেট)"],
  ["Beanibazar", "বিয়ানীবাজার", "Sylhet (সিলেট)"],
  ["Bishwanath", "বিশ্বনাথ", "Sylhet (সিলেট)"],
  ["Sylhet Companiganj", "কোম্পানীগঞ্জ", "Sylhet (সিলেট)"],
  ["Fenchuganj", "ফেঞ্চুগঞ্জ", "Sylhet (সিলেট)"],
  ["Golapganj", "গোলাপগঞ্জ", "Sylhet (সিলেট)"],
  ["Gowainghat", "গোয়াইনঘাট", "Sylhet (সিলেট)"],
  ["Jaintiapur", "জৈন্তাপুর", "Sylhet (সিলেট)"],
  ["Kanaighat", "কানাইঘাট", "Sylhet (সিলেট)"],
  ["Osmani Nagar", "ওসমানীনগর", "Sylhet (সিলেট)"],
  ["Zakiganj", "জকিগঞ্জ", "Sylhet (সিলেট)"],
  ["South Surma", "দক্ষিণ সুরমা", "Sylhet (সিলেট)"],
  ["Ambarkhana", "আম্বরখানা", "Sylhet (সিলেট)"],
  ["Zindabazar", "জিন্দাবাজার", "Sylhet (সিলেট)"],

  // ===== জামালপুর =====
  ["Bakshiganj", "বকশীগঞ্জ", "Jamalpur (জামালপুর)"],
  ["Dewanganj", "দেওয়ানগঞ্জ", "Jamalpur (জামালপুর)"],
  ["Islampur", "ইসলামপুর", "Jamalpur (জামালপুর)"],
  ["Madarganj", "মাদারগঞ্জ", "Jamalpur (জামালপুর)"],
  ["Melandaha", "মেলান্দহ", "Jamalpur (জামালপুর)"],
  ["Sarishabari", "সরিষাবাড়ী", "Jamalpur (জামালপুর)"],

  // ===== ময়মনসিংহ =====
  ["Bhaluka", "ভালুকা", "Mymensingh (ময়মনসিংহ)"],
  ["Dhobaura", "ধোবাউড়া", "Mymensingh (ময়মনসিংহ)"],
  ["Fulbaria", "ফুলবাড়িয়া", "Mymensingh (ময়মনসিংহ)"],
  ["Gaffargaon", "গফরগাঁও", "Mymensingh (ময়মনসিংহ)"],
  ["Gauripur", "গৌরীপুর", "Mymensingh (ময়মনসিংহ)"],
  ["Haluaghat", "হালুয়াঘাট", "Mymensingh (ময়মনসিংহ)"],
  ["Ishwarganj", "ঈশ্বরগঞ্জ", "Mymensingh (ময়মনসিংহ)"],
  ["Muktagachha", "মুক্তাগাছা", "Mymensingh (ময়মনসিংহ)"],
  ["Nandail", "নান্দাইল", "Mymensingh (ময়মনসিংহ)"],
  ["Phulpur", "ফুলপুর", "Mymensingh (ময়মনসিংহ)"],
  ["Tarakanda", "তারাকান্দা", "Mymensingh (ময়মনসিংহ)"],
  ["Trishal", "ত্রিশাল", "Mymensingh (ময়মনসিংহ)"],

  // ===== নেত্রকোণা =====
  ["Atpara", "আটপাড়া", "Netrokona (নেত্রকোণা)"],
  ["Barhatta", "বারহাট্টা", "Netrokona (নেত্রকোণা)"],
  ["Netrokona Durgapur", "দুর্গাপুর", "Netrokona (নেত্রকোণা)"],
  ["Kalmakanda", "কলমাকান্দা", "Netrokona (নেত্রকোণা)"],
  ["Kendua", "কেন্দুয়া", "Netrokona (নেত্রকোণা)"],
  ["Khaliajuri", "খালিয়াজুরী", "Netrokona (নেত্রকোণা)"],
  ["Madan", "মদন", "Netrokona (নেত্রকোণা)"],
  ["Mohanganj", "মোহনগঞ্জ", "Netrokona (নেত্রকোণা)"],
  ["Purbadhala", "পূর্বধলা", "Netrokona (নেত্রকোণা)"],

  // ===== শেরপুর =====
  ["Jhenaigati", "ঝিনাইগাতী", "Sherpur (শেরপুর)"],
  ["Nakla", "নকলা", "Sherpur (শেরপুর)"],
  ["Nalitabari", "নালিতাবাড়ী", "Sherpur (শেরপুর)"],
  ["Sreebardi", "শ্রীবরদী", "Sherpur (শেরপুর)"],

  // ===== কিশোরগঞ্জ =====
  ["Austagram", "অষ্টগ্রাম", "Kishoreganj (কিশোরগঞ্জ)"],
  ["Bajitpur", "বাজিতপুর", "Kishoreganj (কিশোরগঞ্জ)"],
  ["Bhairab", "ভৈরব", "Kishoreganj (কিশোরগঞ্জ)"],
  ["Hossainpur", "হোসেনপুর", "Kishoreganj (কিশোরগঞ্জ)"],
  ["Itna", "ইটনা", "Kishoreganj (কিশোরগঞ্জ)"],
  ["Karimganj Kishoreganj", "করিমগঞ্জ", "Kishoreganj (কিশোরগঞ্জ)"],
  ["Katiadi", "কটিয়াদী", "Kishoreganj (কিশোরগঞ্জ)"],
  ["Kuliarchar", "কুলিয়ারচর", "Kishoreganj (কিশোরগঞ্জ)"],
  ["Mithamain", "মিঠামইন", "Kishoreganj (কিশোরগঞ্জ)"],
  ["Nikli", "নিকলী", "Kishoreganj (কিশোরগঞ্জ)"],
  ["Pakundia", "পাকুন্দিয়া", "Kishoreganj (কিশোরগঞ্জ)"],
  ["Tarail", "তাড়াইল", "Kishoreganj (কিশোরগঞ্জ)"],

  // ===== টাঙ্গাইল =====
  ["Basail", "বাসাইল", "Tangail (টাঙ্গাইল)"],
  ["Bhuapur", "ভূঞাপুর", "Tangail (টাঙ্গাইল)"],
  ["Delduar", "দেলদুয়ার", "Tangail (টাঙ্গাইল)"],
  ["Dhanbari", "ধনবাড়ী", "Tangail (টাঙ্গাইল)"],
  ["Ghatail", "ঘাটাইল", "Tangail (টাঙ্গাইল)"],
  ["Gopalpur Tangail", "গোপালপুর", "Tangail (টাঙ্গাইল)"],
  ["Kalihati", "কালিহাতী", "Tangail (টাঙ্গাইল)"],
  ["Madhupur", "মধুপুর", "Tangail (টাঙ্গাইল)"],
  ["Mirzapur", "মির্জাপুর", "Tangail (টাঙ্গাইল)"],
  ["Nagarpur", "নাগরপুর", "Tangail (টাঙ্গাইল)"],
  ["Sakhipur", "সখীপুর", "Tangail (টাঙ্গাইল)"],

  // ===== মুন্সিগঞ্জ =====
  ["Gazaria", "গজারিয়া", "Munshiganj (মুন্সীগঞ্জ)"],
  ["Lohajang", "লৌহজং", "Munshiganj (মুন্সীগঞ্জ)"],
  ["Sirajdikhan", "সিরাজদিখান", "Munshiganj (মুন্সীগঞ্জ)"],
  ["Sreenagar", "শ্রীনগর", "Munshiganj (মুন্সীগঞ্জ)"],
  ["Tongibari", "টঙ্গীবাড়ী", "Munshiganj (মুন্সীগঞ্জ)"],

  // ===== নরসিংদী =====
  ["Belabo", "বেলাবো", "Narsingdi (নরসিংদী)"],
  ["Monohardi", "মনোহরদী", "Narsingdi (নরসিংদী)"],
  ["Palash", "পলাশ", "Narsingdi (নরসিংদী)"],
  ["Raipura", "রায়পুরা", "Narsingdi (নরসিংদী)"],
  ["Shibpur", "শিবপুর", "Narsingdi (নরসিংদী)"],

  // ===== মানিকগঞ্জ =====
  ["Daulatpur Manikganj", "দৌলতপুর", "Manikganj (মানিকগঞ্জ)"],
  ["Ghior", "ঘিওর", "Manikganj (মানিকগঞ্জ)"],
  ["Harirampur", "হরিরামপুর", "Manikganj (মানিকগঞ্জ)"],
  ["Saturia", "সাটুরিয়া", "Manikganj (মানিকগঞ্জ)"],
  ["Shivalaya", "শিবালয়", "Manikganj (মানিকগঞ্জ)"],
  ["Singair", "সিংগাইর", "Manikganj (মানিকগঞ্জ)"],

  // ===== শরীয়তপুর =====
  ["Bhedarganj", "ভেদরগঞ্জ", "Shariatpur (শরীয়তপুর)"],
  ["Damudya", "ডামুড্যা", "Shariatpur (শরীয়তপুর)"],
  ["Gosairhat", "গোসাইরহাট", "Shariatpur (শরীয়তপুর)"],
  ["Naria", "নড়িয়া", "Shariatpur (শরীয়তপুর)"],
  ["Zajira", "জাজিরা", "Shariatpur (শরীয়তপুর)"],

  // ===== মাদারীপুর =====
  ["Kalkini", "কালকিনি", "Madaripur (মাদারীপুর)"],
  ["Rajoir", "রাজৈর", "Madaripur (মাদারীপুর)"],
  ["Shibchar", "শিবচর", "Madaripur (মাদারীপুর)"],
  ["Dasar", "ডাসার", "Madaripur (মাদারীপুর)"],

  // ===== রাজবাড়ী =====
  ["Baliakandi", "বালিয়াকান্দি", "Rajbari (রাজবাড়ী)"],
  ["Goalandaghat", "গোয়ালন্দ", "Rajbari (রাজবাড়ী)"],
  ["Kalukhali", "কালুখালী", "Rajbari (রাজবাড়ী)"],
  ["Pangsha", "পাংশা", "Rajbari (রাজবাড়ী)"],

  // ===== গোপালগঞ্জ =====
  ["Kashiani", "কাশিয়ানী", "Gopalganj (গোপালগঞ্জ)"],
  ["Kotalipara", "কোটালীপাড়া", "Gopalganj (গোপালগঞ্জ)"],
  ["Muksudpur", "মুকসুদপুর", "Gopalganj (গোপালগঞ্জ)"],
  ["Tungipara", "টুঙ্গিপাড়া", "Gopalganj (গোপালগঞ্জ)"],
];

// text-এর মধ্যে কোনো থানা/উপজেলার নাম (বাংলা বা ইংরেজি) থাকলে সেটার জেলা রিটার্ন করে।
export const detectDistrictFromArea = (text: string): string => {
  if (!text) return "";
  const lowerText = text.toLowerCase();
  for (const [en, bn, district] of AREA_TO_DISTRICT) {
    if (bn && text.includes(bn)) return district;
    if (en && lowerText.includes(en.toLowerCase())) return district;
  }
  return "";
};
