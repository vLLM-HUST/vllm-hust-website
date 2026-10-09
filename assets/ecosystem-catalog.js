(function (global) {
  "use strict";

  const TOOL_MOD_ROLES = new Set([
    "lifecycle_control_plane",
    "model_artifact_preparation",
    "offline_model_quantization",
    "profiling_analysis",
    "scheduler_policy_research",
    "telemetry_provider"
  ]);
  const MOD_DELIVERY_MODELS = new Set([
    "plugin_bundle",
    "python_distribution",
    "migration_scaffold",
    "source_patch",
    "source_toolkit"
  ]);

  function isToolMod(item) {
    return TOOL_MOD_ROLES.has(item?.system_role);
  }

  function isWorkshopMod(item) {
    if (!item || item.public_surface === false) return false;
    const repository = String(item.canonical_repository || "");
    const verifiedBridge = item.artifact_type === "bridge"
      && item.compatibility?.status === "verified"
      && repository.startsWith("https://github.com/");
    const organizationMod = (
      ["runtime_component", "bridge"].includes(item.artifact_type) || isToolMod(item)
    )
      && item.repository_relationship === "organization_native"
      && MOD_DELIVERY_MODELS.has(item.delivery_model)
      && repository.startsWith("https://github.com/vLLM-HUST/");
    return verifiedBridge || organizationMod;
  }

  function summarize(payload) {
    const components = Array.isArray(payload?.components) ? payload.components : [];
    const mods = components.filter(isWorkshopMod);
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

  global.EcosystemCatalog = Object.freeze({ isToolMod, isWorkshopMod, summarize });
})(window);
