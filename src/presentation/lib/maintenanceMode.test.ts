import { describe, expect, it } from "vitest";
import { defaultPublicAppConfig } from "../../domain/fantasy/entities/AppConfig";
import { shouldBlockForMaintenance } from "./maintenanceMode";

describe("shouldBlockForMaintenance", () => {
  it("blocks every non-allowed path in full maintenance mode", () => {
    const config = defaultPublicAppConfig();
    config.maintenance.enabled = true;
    config.maintenance.mode = "full";
    config.maintenance.allowPaths = ["/login"];

    expect(shouldBlockForMaintenance({ pathname: "/", config })).toBe(true);
    expect(shouldBlockForMaintenance({ pathname: "/login", config })).toBe(false);
  });

  it("allows bypass users during maintenance", () => {
    const config = defaultPublicAppConfig();
    config.maintenance.enabled = true;
    config.maintenance.mode = "full";
    config.maintenance.allowedUserIds = ["admin-1"];

    expect(shouldBlockForMaintenance({ pathname: "/", config, userId: "admin-1" })).toBe(false);
  });

  it("blocks only configured write paths in read-only mode", () => {
    const config = defaultPublicAppConfig();
    config.maintenance.enabled = true;
    config.maintenance.mode = "read_only";
    config.maintenance.blockedPaths = ["/pick-team", "/transfers"];

    expect(shouldBlockForMaintenance({ pathname: "/pick-team", config })).toBe(true);
    expect(shouldBlockForMaintenance({ pathname: "/fixtures", config })).toBe(false);
  });
});
