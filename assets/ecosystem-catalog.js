(function (global) {
  "use strict";

  const ACTIVE_MOD_KINDS = new Set([
    "runtime_mod",
    "connector_mod",
    "tool_mod",
    "control_plane"
  ]);

  function taxonomyComponents(taxonomy) {
    if (taxonomy?.schema_version !== "mod-taxonomy/v1" || !taxonomy.components) {
      throw new Error("unsupported MOD taxonomy");
    }
    return taxonomy.components;
  }

  function isWorkshopMod(item, taxonomy) {
    if (!item || item.public_surface === false) return false;
    const profile = taxonomyComponents(taxonomy)[item.id];
    return Boolean(profile && ACTIVE_MOD_KINDS.has(profile.kind));
  }

  function summarize(payload, taxonomy) {
    const components = Array.isArray(payload?.components) ? payload.components : [];
    const classified = components.filter((item) => isWorkshopMod(item, taxonomy));
    const projects = new Map();
    classified.forEach((item) => {
      const projectId = item.catalog_project_id || item.id;
      const current = projects.get(projectId);
      if (!current || item.catalog_primary_component === item.id) {
        projects.set(projectId, item);
      }
    });
    const mods = [...projects.values()];
    return {
      mods,
      total: mods.length,
      verified: mods.filter((item) => ["ready", "verified"].includes(item.compatibility?.status)).length,
      evaluating: mods.filter((item) => ["experimental", "inspect_only"].includes(item.compatibility?.status)).length,
      evidenced: mods.filter((item) => [
        "hardware_verified", "performance_verified", "production_observed"
      ].includes(item.evidence_level)).length
    };
  }

  global.EcosystemCatalog = Object.freeze({ isWorkshopMod, summarize });
})(window);
