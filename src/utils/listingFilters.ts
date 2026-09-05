/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Pure, stateless helpers extracted out of App.tsx (which had grown to ~2800
// lines). These three functions don't touch React state or hooks -- they
// just take plain inputs and return plain outputs -- so moving them here is
// a behavior-neutral change: same logic, same call sites, just a smaller
// App.tsx and an easier place to find/unit-test this filtering logic later.

import { PartListing } from "../types";

export const checkIsProduction = (): boolean => {
  if (typeof window !== "undefined") {
    if (window.location.hostname.includes("ais-pre-") || window.location.hostname.includes("production")) {
      return true;
    }
    if (window.location.search.includes("prod=true")) {
      return true;
    }
  }
  return import.meta.env.PROD || (typeof process !== "undefined" && process.env && process.env.NODE_ENV === "production");
};

export const isItemVehicle = (item: PartListing): boolean => {
  if (!item) return false;
  if (item.category === "vehicles") return true;
  if (item.category === "spare_parts") return false;

  // Fallback check on subcategory
  if (item.subCategory) {
    const isVehicleSub = ["excavator", "crane", "car", "bus", "bulldozer", "forklift", "other_heavy_equipment"].includes(item.subCategory);
    if (isVehicleSub) return true;
    const isPartsSub = ["engine_part", "light", "pump", "controller", "drive_motor", "other_part"].includes(item.subCategory);
    if (isPartsSub) return false;
  }

  // Default fallback check based on keywords in title
  const titleLower = (item.title || "").toLowerCase();
  const vehicleKeywords = ["excavator", "crane", "bulldozer", "forklift", "loader", "car", "bus", "truck", "pickup", "hilux", "toyota", "komatsu", "crawler", "মেশিন", "গাড়ি", "এক্সকাভেটর", "এক্সক্যাভেটর", "ক্রেন", "বুলডোজার", "বাস"];
  if (vehicleKeywords.some(keyword => titleLower.includes(keyword))) {
    // Make sure it's not a spare part of a vehicle
    const partKeywords = ["part", "pump", "chain", "pulley", "hook", "motor", "engine", "piston", "filter", "পার্ট", "পাম্প", "চেইন", "ইঞ্জিন", "মোটর"];
    if (partKeywords.some(keyword => titleLower.includes(keyword))) {
      return false; // probably a spare part
    }
    return true;
  }

  return false; // Default to parts/machinery
};

// Shared sub-category matcher, used both by the visible-list filter (filteredListings)
// and by handleLoadMoreListings' pagination loop. Previously the pagination loop only
// checked the parent category (vehicles vs spare_parts) and ignored selectedSubCategory,
// so "Load More" would stop early after finding a handful of e.g. any vehicle, even if
// none of them were the specific sub-category (like Excavator) the person had selected -
// making it look like there were no matches until enough extra clicks happened to surface one.
export const matchesSubCategoryFilter = (item: PartListing, subCategory: string): boolean => {
  if (subCategory === "all") return true;

  const matchesField = item.subCategory === subCategory || item.category === subCategory;

  const textToSearch = ((item.title || "") + " " + (item.description || "")).toLowerCase();
  let matchesText = false;

  if (subCategory === "excavator") {
    matchesText = textToSearch.includes("excavator") || textToSearch.includes("এক্সক্যাভেটর") || textToSearch.includes("এক্সকাভেটর");
  } else if (subCategory === "crane") {
    matchesText = textToSearch.includes("crane") || textToSearch.includes("ক্রেন");
  } else if (subCategory === "car") {
    matchesText = textToSearch.includes("car") || textToSearch.includes("কার") || textToSearch.includes("toyota") || textToSearch.includes("jeep") || textToSearch.includes("pickup") || textToSearch.includes("noah") || textToSearch.includes("hilux");
  } else if (subCategory === "bus") {
    matchesText = textToSearch.includes("bus") || textToSearch.includes("বাস");
  } else if (subCategory === "bulldozer") {
    matchesText = textToSearch.includes("bulldozer") || textToSearch.includes("বুলডোজার") || textToSearch.includes("dozer");
  } else if (subCategory === "forklift") {
    matchesText = textToSearch.includes("forklift") || textToSearch.includes("ফর্কলিফ্ট") || textToSearch.includes("forkclip");
  } else if (subCategory === "other_heavy_equipment") {
    matchesText = textToSearch.includes("heavy") || textToSearch.includes("loader") || textToSearch.includes("পল্লক") || textToSearch.includes("pulle");
  } else if (subCategory === "engine_part") {
    matchesText = textToSearch.includes("engine") || textToSearch.includes("ইঞ্জিন") || textToSearch.includes("cylinder") || textToSearch.includes("sleeve") || textToSearch.includes("gear") || textToSearch.includes("transmission") || textToSearch.includes("গিয়ার") || textToSearch.includes("chain") || textToSearch.includes("চেইন");
  } else if (subCategory === "light") {
    matchesText = textToSearch.includes("light") || textToSearch.includes("লাইট") || textToSearch.includes("bulb") || textToSearch.includes("বডি");
  } else if (subCategory === "pump") {
    matchesText = textToSearch.includes("pump") || textToSearch.includes("পাম্প") || textToSearch.includes("hydraulic") || textToSearch.includes("হাইড্রলিক");
  } else if (subCategory === "controller") {
    matchesText = textToSearch.includes("controller") || textToSearch.includes("কন্ট্রোলার");
  } else if (subCategory === "drive_motor") {
    matchesText = textToSearch.includes("motor") || textToSearch.includes("মোটর") || textToSearch.includes("drive");
  } else if (subCategory === "other_part") {
    matchesText = true;
  }

  return matchesField || matchesText;
};
