import { getUncachableRevenueCatClient } from "./revenueCatClient";

import {
  listProjects,
  createProject,
  listApps,
  createApp,
  listAppPublicApiKeys,
  listProducts,
  createProduct,
  listEntitlements,
  createEntitlement,
  attachProductsToEntitlement,
  listOfferings,
  createOffering,
  updateOffering,
  listPackages,
  createPackages,
  attachProductsToPackage,
  type App,
  type Product,
  type Project,
  type Entitlement,
  type Offering,
  type Package,
  type CreateProductData,
} from "@replit/revenuecat-sdk";

const PROJECT_NAME = "Rhome";
const APP_STORE_APP_NAME = "Rhome iOS";
const APP_STORE_BUNDLE_ID = "com.rhome.app";
const PLAY_STORE_APP_NAME = "Rhome Android";
const PLAY_STORE_PACKAGE_NAME = "com.rhome.app";

interface ProductConfig {
  identifier: string;
  playStoreIdentifier: string;
  displayName: string;
  title: string;
  duration: "P1M" | "P3M" | "P1Y";
  priceMicros: number;
  entitlement: string;
  packageKey: string;
  packageDisplay: string;
}

interface EntitlementConfig {
  key: string;
  display: string;
}

const ENTITLEMENTS: EntitlementConfig[] = [
  { key: "plus", display: "Rhome Plus" },
  { key: "elite", display: "Rhome Elite" },
  { key: "host_starter", display: "Host Starter" },
  { key: "host_pro", display: "Host Pro" },
  { key: "host_business", display: "Host Business" },
];

const PRODUCTS: ProductConfig[] = [
  { identifier: "rhome_plus_monthly", playStoreIdentifier: "rhome_plus_monthly:monthly", displayName: "Plus Monthly", title: "Rhome Plus Monthly", duration: "P1M", priceMicros: 14990000, entitlement: "plus", packageKey: "$rc_monthly", packageDisplay: "Plus Monthly" },
  { identifier: "rhome_plus_3month", playStoreIdentifier: "rhome_plus_3month:three-month", displayName: "Plus 3 Month", title: "Rhome Plus 3 Month", duration: "P3M", priceMicros: 40470000, entitlement: "plus", packageKey: "$rc_three_month", packageDisplay: "Plus 3 Month" },
  { identifier: "rhome_plus_annual", playStoreIdentifier: "rhome_plus_annual:annual", displayName: "Plus Annual", title: "Rhome Plus Annual", duration: "P1Y", priceMicros: 149300000, entitlement: "plus", packageKey: "$rc_annual", packageDisplay: "Plus Annual" },
  { identifier: "rhome_elite_monthly", playStoreIdentifier: "rhome_elite_monthly:monthly", displayName: "Elite Monthly", title: "Rhome Elite Monthly", duration: "P1M", priceMicros: 29990000, entitlement: "elite", packageKey: "$rc_monthly", packageDisplay: "Elite Monthly" },
  { identifier: "rhome_elite_3month", playStoreIdentifier: "rhome_elite_3month:three-month", displayName: "Elite 3 Month", title: "Rhome Elite 3 Month", duration: "P3M", priceMicros: 80970000, entitlement: "elite", packageKey: "$rc_three_month", packageDisplay: "Elite 3 Month" },
  { identifier: "rhome_elite_annual", playStoreIdentifier: "rhome_elite_annual:annual", displayName: "Elite Annual", title: "Rhome Elite Annual", duration: "P1Y", priceMicros: 298700000, entitlement: "elite", packageKey: "$rc_annual", packageDisplay: "Elite Annual" },
  { identifier: "rhome_host_starter_monthly", playStoreIdentifier: "rhome_host_starter_monthly:monthly", displayName: "Host Starter Monthly", title: "Host Starter Monthly", duration: "P1M", priceMicros: 29990000, entitlement: "host_starter", packageKey: "$rc_monthly", packageDisplay: "Host Starter Monthly" },
  { identifier: "rhome_host_pro_monthly", playStoreIdentifier: "rhome_host_pro_monthly:monthly", displayName: "Host Pro Monthly", title: "Host Pro Monthly", duration: "P1M", priceMicros: 59990000, entitlement: "host_pro", packageKey: "$rc_monthly", packageDisplay: "Host Pro Monthly" },
  { identifier: "rhome_host_business_monthly", playStoreIdentifier: "rhome_host_business_monthly:monthly", displayName: "Host Business Monthly", title: "Host Business Monthly", duration: "P1M", priceMicros: 99990000, entitlement: "host_business", packageKey: "$rc_monthly", packageDisplay: "Host Business Monthly" },
];

type TestStorePricesResponse = {
  object: string;
  prices: { amount_micros: number; currency: string }[];
};

async function sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      if (e?.type === 'rate_limit_error' || e?.message?.includes('rate') || e?.message?.includes('Too many')) {
        const backoff = (e?.backoff_ms || 20000) + 2000;
        console.log(`Rate limited, waiting ${backoff / 1000}s...`);
        await sleep(backoff);
      } else {
        throw e;
      }
    }
  }
  throw new Error('Max retries exceeded');
}

async function seedRevenueCat() {
  const client = await getUncachableRevenueCatClient();

  let project: Project;
  const { data: existingProjects, error: listProjectsError } = await listProjects({
    client,
    query: { limit: 20 },
  });
  if (listProjectsError) throw new Error("Failed to list projects");

  const existingProject = existingProjects.items?.find((p) => p.name === PROJECT_NAME);
  if (existingProject) {
    console.log("Project already exists:", existingProject.id);
    project = existingProject;
  } else {
    const { data: newProject, error } = await createProject({
      client,
      body: { name: PROJECT_NAME },
    });
    if (error) throw new Error("Failed to create project");
    console.log("Created project:", newProject.id);
    project = newProject;
  }

  const { data: apps, error: listAppsError } = await listApps({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listAppsError || !apps || apps.items.length === 0) throw new Error("No apps found");

  let testStoreApp: App | undefined = apps.items.find((a) => a.type === "test_store");
  let appStoreApp: App | undefined = apps.items.find((a) => a.type === "app_store");
  let playStoreApp: App | undefined = apps.items.find((a) => a.type === "play_store");

  if (!testStoreApp) throw new Error("No test store app found");
  console.log("Test store app found:", testStoreApp.id);

  if (!appStoreApp) {
    const { data: newApp, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: { name: APP_STORE_APP_NAME, type: "app_store", app_store: { bundle_id: APP_STORE_BUNDLE_ID } },
    });
    if (error) throw new Error("Failed to create App Store app");
    appStoreApp = newApp;
    console.log("Created App Store app:", appStoreApp.id);
  } else {
    console.log("App Store app found:", appStoreApp.id);
  }

  if (!playStoreApp) {
    const { data: newApp, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: { name: PLAY_STORE_APP_NAME, type: "play_store", play_store: { package_name: PLAY_STORE_PACKAGE_NAME } },
    });
    if (error) throw new Error("Failed to create Play Store app");
    playStoreApp = newApp;
    console.log("Created Play Store app:", playStoreApp.id);
  } else {
    console.log("Play Store app found:", playStoreApp.id);
  }

  const { data: existingProducts, error: listProductsError } = await listProducts({
    client,
    path: { project_id: project.id },
    query: { limit: 100 },
  });
  if (listProductsError) throw new Error("Failed to list products");

  const ensureProduct = async (targetApp: App, label: string, identifier: string, isTestStore: boolean, config: ProductConfig): Promise<Product> => {
    const existing = existingProducts.items?.find((p) => p.store_identifier === identifier && p.app_id === targetApp.id);
    if (existing) {
      console.log(`${label} product "${config.displayName}" already exists:`, existing.id);
      return existing;
    }

    const body: CreateProductData["body"] = {
      store_identifier: identifier,
      app_id: targetApp.id,
      type: "subscription",
      display_name: config.displayName,
    };

    if (isTestStore) {
      body.subscription = { duration: config.duration };
      body.title = config.title;
    }

    const { data: created, error } = await createProduct({
      client,
      path: { project_id: project.id },
      body,
    });
    if (error) throw new Error(`Failed to create ${label} product "${config.displayName}"`);
    console.log(`Created ${label} product "${config.displayName}":`, created.id);
    return created;
  };

  const productMap: Record<string, { test: Product; appStore: Product; playStore: Product }> = {};

  for (const config of PRODUCTS) {
    const test = await ensureProduct(testStoreApp, "Test Store", config.identifier, true, config);
    const appStore = await ensureProduct(appStoreApp, "App Store", config.identifier, false, config);
    const playStore = await ensureProduct(playStoreApp, "Play Store", config.playStoreIdentifier, false, config);
    productMap[config.identifier] = { test, appStore, playStore };
    await sleep(1500);

    const { error: priceError } = await (client as any).post({
      url: "/projects/{project_id}/products/{product_id}/test_store_prices",
      path: { project_id: project.id, product_id: test.id },
      body: { prices: [{ amount_micros: config.priceMicros, currency: "USD" }] },
    });
    if (priceError) {
      if (priceError?.type === "resource_already_exists") {
        console.log(`Test store prices already exist for "${config.displayName}"`);
      } else {
        console.warn(`Warning: Could not set test store prices for "${config.displayName}"`, priceError);
      }
    } else {
      console.log(`Set test store price for "${config.displayName}"`);
    }
    await sleep(1000);
  }

  const { data: existingEntitlements, error: listEntitlementsError } = await listEntitlements({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listEntitlementsError) throw new Error("Failed to list entitlements");

  const entitlementMap: Record<string, Entitlement> = {};

  for (const entConfig of ENTITLEMENTS) {
    const existing = existingEntitlements.items?.find((e) => e.lookup_key === entConfig.key);
    if (existing) {
      console.log(`Entitlement "${entConfig.key}" already exists:`, existing.id);
      entitlementMap[entConfig.key] = existing;
    } else {
      const { data: created, error } = await createEntitlement({
        client,
        path: { project_id: project.id },
        body: { lookup_key: entConfig.key, display_name: entConfig.display },
      });
      if (error) throw new Error(`Failed to create entitlement "${entConfig.key}"`);
      console.log(`Created entitlement "${entConfig.key}":`, created.id);
      entitlementMap[entConfig.key] = created;
    }
  }

  for (const config of PRODUCTS) {
    const entitlement = entitlementMap[config.entitlement];
    const products = productMap[config.identifier];
    const { error } = await attachProductsToEntitlement({
      client,
      path: { project_id: project.id, entitlement_id: entitlement.id },
      body: { product_ids: [products.test.id, products.appStore.id, products.playStore.id] },
    });
    if (error) {
      if ((error as any).type === "unprocessable_entity_error") {
        console.log(`Products already attached to "${config.entitlement}" entitlement`);
      } else {
        console.warn(`Warning: Could not attach "${config.identifier}" to "${config.entitlement}"`, error);
      }
    } else {
      console.log(`Attached "${config.identifier}" products to "${config.entitlement}" entitlement`);
    }
    await sleep(1000);
  }

  const offeringConfigs = [
    { key: "renter_plans", display: "Renter Plans", products: PRODUCTS.filter(p => ["plus", "elite"].includes(p.entitlement)) },
    { key: "host_plans", display: "Host Plans", products: PRODUCTS.filter(p => p.entitlement.startsWith("host_")) },
  ];

  const { data: existingOfferings, error: listOfferingsError } = await listOfferings({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listOfferingsError) throw new Error("Failed to list offerings");

  let defaultOfferingSet = false;

  for (const offeringConfig of offeringConfigs) {
    let offering: Offering | undefined = existingOfferings.items?.find((o) => o.lookup_key === offeringConfig.key);

    if (offering) {
      console.log(`Offering "${offeringConfig.key}" already exists:`, offering.id);
    } else {
      await sleep(2000);
      const { data: created, error } = await createOffering({
        client,
        path: { project_id: project.id },
        body: { lookup_key: offeringConfig.key, display_name: offeringConfig.display },
      });
      if (error) throw new Error(`Failed to create offering "${offeringConfig.key}"`);
      console.log(`Created offering "${offeringConfig.key}":`, created.id);
      offering = created;
    }

    if (!defaultOfferingSet && !offering.is_current) {
      const { error } = await updateOffering({
        client,
        path: { project_id: project.id, offering_id: offering.id },
        body: { is_current: true },
      });
      if (!error) {
        console.log(`Set "${offeringConfig.key}" as current offering`);
        defaultOfferingSet = true;
      }
    }

    const { data: existingPkgs, error: listPkgsError } = await listPackages({
      client,
      path: { project_id: project.id, offering_id: offering.id },
      query: { limit: 50 },
    });
    if (listPkgsError) throw new Error("Failed to list packages");

    for (const prodConfig of offeringConfig.products) {
      const pkgLookupKey = `${prodConfig.identifier}`;
      let pkg: Package | undefined = existingPkgs.items?.find((p) => p.lookup_key === pkgLookupKey);

      if (pkg) {
        console.log(`Package "${pkgLookupKey}" already exists:`, pkg.id);
      } else {
        await sleep(2000);
        const { data: created, error } = await createPackages({
          client,
          path: { project_id: project.id, offering_id: offering.id },
          body: { lookup_key: pkgLookupKey, display_name: prodConfig.packageDisplay },
        });
        if (error) {
          console.warn(`Warning: Could not create package "${pkgLookupKey}"`, error);
          continue;
        }
        console.log(`Created package "${pkgLookupKey}":`, created.id);
        pkg = created;
      }

      const products = productMap[prodConfig.identifier];
      await sleep(1500);
      const { error: attachError } = await attachProductsToPackage({
        client,
        path: { project_id: project.id, package_id: pkg.id },
        body: {
          products: [
            { product_id: products.test.id, eligibility_criteria: "all" },
            { product_id: products.appStore.id, eligibility_criteria: "all" },
            { product_id: products.playStore.id, eligibility_criteria: "all" },
          ],
        },
      });
      if (attachError) {
        if ((attachError as any).message?.includes("Cannot attach") || (attachError as any).type === "unprocessable_entity_error") {
          console.log(`Products already attached to package "${pkgLookupKey}"`);
        } else {
          console.warn(`Warning: Could not attach products to package "${pkgLookupKey}"`, attachError);
        }
      } else {
        console.log(`Attached products to package "${pkgLookupKey}"`);
      }
    }
  }

  const { data: testKeys } = await listAppPublicApiKeys({ client, path: { project_id: project.id, app_id: testStoreApp.id } });
  const { data: iosKeys } = await listAppPublicApiKeys({ client, path: { project_id: project.id, app_id: appStoreApp.id } });
  const { data: androidKeys } = await listAppPublicApiKeys({ client, path: { project_id: project.id, app_id: playStoreApp.id } });

  console.log("\n====================");
  console.log("RevenueCat setup complete!");
  console.log("Project ID:", project.id);
  console.log("Test Store App ID:", testStoreApp.id);
  console.log("App Store App ID:", appStoreApp.id);
  console.log("Play Store App ID:", playStoreApp.id);
  console.log("");
  console.log("Public API Keys:");
  console.log("  Test Store:", testKeys?.items.map((item) => item.key).join(", ") ?? "N/A");
  console.log("  App Store (iOS):", iosKeys?.items.map((item) => item.key).join(", ") ?? "N/A");
  console.log("  Play Store (Android):", androidKeys?.items.map((item) => item.key).join(", ") ?? "N/A");
  console.log("");
  console.log("Entitlements:", ENTITLEMENTS.map(e => e.key).join(", "));
  console.log("====================\n");
  console.log("NEXT STEPS:");
  console.log("1. Add these as Replit secrets:");
  console.log("   EXPO_PUBLIC_REVENUECAT_TEST_API_KEY = <Test Store key above>");
  console.log("   EXPO_PUBLIC_REVENUECAT_IOS_API_KEY = <App Store key above>");
  console.log("   EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY = <Play Store key above>");
  console.log("   REVENUECAT_PROJECT_ID = " + project.id);
}

seedRevenueCat().catch(console.error);
