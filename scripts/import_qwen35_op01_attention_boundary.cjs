#!/usr/bin/env node

/**
 * Import the OP01 compliant C1/C2/C4/C8/C16 ON/OFF sweep.
 *
 * The measured source is intentionally a new campaign. The earlier local
 * f4eacc39 points are moved to archived_points unchanged instead of being
 * relabelled as the 4a1843d measurement. Every formal repeat gets a run and a
 * point record; only the pre-declared median repeat for each mode/concurrency
 * is placed in the displayed series.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const WEBSITE = path.resolve(__dirname, '..');
const TASK = path.resolve(
  process.env.OP01_TASK_ROOT || path.resolve(__dirname, '..', '..'),
);
const RAW = path.join(TASK, 'op01-evidence');
const COHORT_ID = 'qwen35-35b-a3b-bf16-sweprefix-smoke-v1';
const CONCURRENCIES = [1, 2, 4, 8, 16];
const REPEATS = 3;
const CAMPAIGN_DATE = '20261008';
const CAMPAIGN = 'qwen35-op01-attention-boundary-tp2ep-20261008';
const DISPLAY_SERIES_PREFIX = 'swe-op01-ascend-boundary-v2-';
const DISPLAY_SERIES = {
  off: `${DISPLAY_SERIES_PREFIX}off-tp2ep-${CAMPAIGN_DATE}`,
  on: `${DISPLAY_SERIES_PREFIX}on-tp2ep-${CAMPAIGN_DATE}`,
};
const REPEAT_SERIES = {
  off: `${DISPLAY_SERIES_PREFIX}off-tp2ep-${CAMPAIGN_DATE}-repeat-evidence`,
  on: `${DISPLAY_SERIES_PREFIX}on-tp2ep-${CAMPAIGN_DATE}-repeat-evidence`,
};
const CANONICAL_WORKLOAD_SHA =
  '8044561ffa1bb430bea8f778ef814d96649321e1a92654b95f64263b996d5e85'; // pragma: allowlist secret
const MEASURED_WORKLOAD_SHA =
  'dff300c473f0407681c379bdea846756509e436d7faa1539479c17acd2ed2d7b'; // pragma: allowlist secret
const CANONICAL_TOKENIZER_FINGERPRINT =
  '3f9ca78537850303ee04bfa6640c020be89723c62f37121c0f27a4c0babc53e0'; // pragma: allowlist secret
const MEASURED_TOKENIZER_FINGERPRINT =
  '319f580a2fc8d2ff1e1f48a26ea0c29eea35798d747e7188ca584e92c014bdf9'; // pragma: allowlist secret
const MOD_REPOSITORY =
  'https://github.com/xmdhb/vllm-hust-ascend-attention-boundary';
const MOD_REVISION = '4a1843d1e2a81f0415a1cfa5141e9b17b3262835'; // pragma: allowlist secret
const MOD_WHEEL_SHA256 =
  'aac1f8c9e73d7cf58f75eac7ca7d31d47370e55482fd614934ad7f8cf7aa63c6'; // pragma: allowlist secret
const BENCHMARK_REVISION = '695dd8b1ab280145627a108b434f7a54cca05810'; // pragma: allowlist secret
const BENCHMARK_REPOSITORY =
  'https://github.com/vLLM-HUST/swe-prefix-reuse';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function relativeTask(file) {
  return path.relative(TASK, file).split(path.sep).join('/');
}

function quantile(values, q) {
  const ordered = [...values].sort((a, b) => a - b);
  if (!ordered.length) throw new Error('quantile requires at least one value');
  const position = (ordered.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return ordered[lower];
  return ordered[lower] + (position - lower) * (ordered[upper] - ordered[lower]);
}

function requestMetrics(requestsFile, summary) {
  const rows = fs
    .readFileSync(requestsFile, 'utf8')
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map(JSON.parse);
  const completed = rows.filter(
    (row) =>
      row.success &&
      row.end != null &&
      row.end <= 900 &&
      row.first_token != null &&
      row.last_token != null &&
      row.decode_tokens_per_second,
  );
  if (completed.length !== summary.requests_completed_in_window) {
    throw new Error(
      `completed request mismatch: ${completed.length} != ${summary.requests_completed_in_window}`,
    );
  }
  const tpot = completed.map((row) => 1000 / row.decode_tokens_per_second);
  const e2e = completed.map((row) => 1000 * (row.last_token - row.start));
  return {
    output_tps: summary.output_tokens_per_second,
    decode_p90_tps: summary.decode_tokens_per_second_p90,
    ttft_p95_ms: summary.ttft_seconds_p95 * 1000,
    tpot_ms: tpot.reduce((sum, value) => sum + value, 0) / tpot.length,
    tpot_p95_ms: quantile(tpot, 0.95),
    e2e_p95_ms: quantile(e2e, 0.95),
    completed_requests: summary.requests_completed_in_window,
  };
}

function artifact(file) {
  return {
    path: relativeTask(file),
    sha256: sha256(file),
    bytes: fs.statSync(file).size,
  };
}

function countMatches(text, pattern) {
  return text.match(pattern)?.length || 0;
}

function activationDetails(logFile) {
  const text = fs.readFileSync(logFile, 'utf8');
  const formalLines = text
    .split(/\r?\n/)
    .filter((line) =>
      /LEGACY017_EVIDENCE runtime_effective.*phase=formal_request/.test(line),
    );
  const formalRunIds = [
    ...new Set(
      formalLines
        .map((line) => line.match(/\brun_id=([^\s]+)/)?.[1])
        .filter(Boolean),
    ),
  ];
  return {
    installed: countMatches(text, /LEGACY017_EVIDENCE installed/g),
    runtime_effective: countMatches(text, /LEGACY017_EVIDENCE runtime_effective/g),
    formal_request_runtime_effective: formalLines.length,
    formal_request_lines: formalLines,
    formal_request_run_ids: formalRunIds,
  };
}

function clientExtract(config) {
  const keys = [
    'tool_version',
    'schema',
    'run_id',
    'started_at_unix',
    'model',
    'workload_sha256',
    'tokenizer',
    'concurrency',
    'duration',
    'chips',
    'seed',
    'timeout',
    'server_max_context',
    'cache_policy',
    'window_policy',
  ];
  return Object.fromEntries(keys.map((key) => [key, config[key]]));
}

function serverExtract(config) {
  const metadata = config.server_metadata;
  const environment = Object.fromEntries(
    Object.entries(metadata.server.environment || {}).filter(
      ([key]) => key !== 'PYTHONPATH',
    ),
  );
  return {
    engine: metadata.engine,
    model: metadata.model,
    precision: metadata.precision,
    tokenizer: metadata.tokenizer,
    hardware: metadata.hardware,
    server: {
      host: metadata.server.host,
      port: metadata.server.port,
      max_model_len: metadata.server.max_model_len,
      tensor_parallel_size: metadata.server.tensor_parallel_size,
      expert_parallel: metadata.server.expert_parallel,
      environment,
      launch_command_redacted: metadata.server.launch_command.replace(
        /\/models\/Qwen3\.5-35B-A3B|\/models\/modelscope_cache\/Qwen\/Qwen3___5-35B-A3B/g,
        '<MODEL_PATH>',
      ),
    },
    mod: metadata.mod,
    workload: metadata.workload,
  };
}

function pointId(mode, concurrency, repeat, selected) {
  const base = `qwen35-op01-attention-boundary-${mode}-tp2ep-c${concurrency}-${CAMPAIGN_DATE}`;
  return selected ? base : `${base}-r${repeat}`;
}

function selectionRecord(candidates, selected, mode, concurrency) {
  return {
    method:
      'median output_tokens_per_second among three valid 900s windows; ties broken by run_id',
    declared_before_measurement: true,
    mode,
    concurrency,
    sample_count: candidates.length,
    selected_run_id: selected.config.run_id,
    selected_directory: selected.formalDirName,
    selected_output_tps: selected.metrics.output_tps,
    ranked_candidates: [...candidates]
      .sort(
        (a, b) =>
          a.metrics.output_tps - b.metrics.output_tps ||
          a.config.run_id.localeCompare(b.config.run_id),
      )
      .map((candidate) => ({
        run_id: candidate.config.run_id,
        directory: candidate.formalDirName,
        output_tps: candidate.metrics.output_tps,
        point_id: pointId(
          mode,
          concurrency,
          candidate.repeat,
          candidate === selected,
        ),
      })),
  };
}

function makePoint(candidate, selection, mode, concurrency) {
  const enabled = mode === 'on';
  const { config, summary, metrics, formalDir, formalDirName, logFile, probeDir } =
    candidate;
  const metadata = config.server_metadata;
  const selected = candidate.config.run_id === selection.selected_run_id;
  const id = pointId(mode, concurrency, candidate.repeat, selected);
  const engine = metadata.engine;
  const activation = activationDetails(logFile);
  const parameters = {
    tensor_parallel_size: metadata.server.tensor_parallel_size,
    pipeline_parallel_size: 1,
    data_parallel_size: 1,
    expert_parallel: metadata.server.expert_parallel,
    dtype: metadata.precision,
    kv_cache_dtype: 'auto',
    block_size: 128,
    max_model_len: metadata.server.max_model_len,
    max_num_seqs: 16,
    max_num_batched_tokens: 8192,
    gpu_memory_utilization: 0.85,
    prefix_caching: false,
    chunked_prefill: true,
    graph_mode: 'FULL_DECODE_ONLY',
    graph_capture_sizes: [1, 2, 4, 8, 16],
    mtp_draft_tokens: 0,
    thinking: config.tokenizer.enable_thinking,
    generation_temperature: 0,
    scheduling_policy: 'fcfs',
    distributed_executor_backend: 'mp',
    disable_custom_all_reduce: true,
    trust_remote_code: false,
    load_format: 'auto',
    enable_log_requests: false,
    runtime_versions: {
      vllm: engine.version,
      'vllm-ascend': engine.backend.version,
      benchmark_tool: config.tool_version,
    },
    runtime_commits: {
      vllm: engine.commit,
      'vllm-ascend': engine.backend.commit,
    },
    model_identity: {
      served_name: metadata.model.served_name,
      path: metadata.model.path,
      revision: metadata.model.revision,
      config_sha256: metadata.model.config_sha256,
      checkpoint_identity_verified: false,
      status: 'checkpoint identity not independently verified',
    },
    mod: {
      package: metadata.mod.name,
      version: metadata.mod.version,
      source_commit: metadata.mod.source_commit,
      wheel_sha256: metadata.mod.wheel_sha256,
      enable: metadata.mod.enable,
      kill_switch: metadata.mod.kill_switch,
      evidence: metadata.mod.evidence,
      manager_version: '0.2.0.dev0',
      manager_source_commit: '52e96021c8017938b133ddba895795a13f707568', // pragma: allowlist secret
      formal_request_runtime_effective_events:
        activation.formal_request_runtime_effective,
    },
    mod_catalog_status: 'registered in local ecosystem snapshot; preview only',
    workload_file_sha256: config.workload_sha256,
    tokenizer_fingerprint: config.tokenizer.fingerprint,
    tokenizer_identity_independently_verified: false,
    tokenizer_transformers: config.tokenizer.transformers,
    observed_max_prompt_tokens: summary.max_prompt_tokens_observed,
    completed_sessions: summary.sessions_completed,
    measured_mean_client_inflight: summary.mean_client_inflight,
    full_client_concurrency_fraction: summary.full_concurrency_fraction,
    warmup_policy: 'Separate 20s protocol probe; formal window uses fresh salts and no primers',
    execution_host: 'user-provided Kubernetes container',
    participating_deployment_chips: config.chips,
    transport: 'Client and server on execution-host loopback',
    server_command_redacted: metadata.server.launch_command.replace(
      /\/models\/Qwen3\.5-35B-A3B|\/models\/modelscope_cache\/Qwen\/Qwen3___5-35B-A3B/g,
      '<MODEL_PATH>',
    ),
    server_environment: Object.fromEntries(
      Object.entries(metadata.server.environment || {}).filter(
        ([key]) => key !== 'PYTHONPATH',
      ),
    ),
  };
  return {
    id,
    cohort_id: COHORT_ID,
    label: `OP01 Ascend attention boundary ${enabled ? 'ON' : 'OFF'} · TP2+EP · C${concurrency}${selected ? '' : ` · repeat ${candidate.repeat}`}`,
    configuration: {
      engine: 'vLLM + vLLM-Ascend',
      engine_version: `${engine.version} / ${engine.backend.version}`,
      mods: enabled ? ['ascend-attention-boundary'] : [],
      hardware: {
        label: metadata.hardware.chip_model,
        accelerator_count: metadata.hardware.chip_count,
      },
      context_capacity_tokens: config.server_max_context,
      parameters,
      mod_sources: enabled
        ? [
            {
              id: 'ascend-attention-boundary',
              repository: MOD_REPOSITORY,
              revision: metadata.mod.source_commit,
              visibility_status:
                'source URL recorded; measured commit is local and not publicly verified',
              source_package: metadata.mod.name,
              wheel_sha256: metadata.mod.wheel_sha256,
              scope:
                'Ascend split_decodes_and_prefills boundary search path exercised by the ON server.',
            },
          ]
        : [],
    },
    load: {
      concurrency,
      unit: 'continuously replenished in-flight HTTP request lanes',
      concurrency_series: selected
        ? DISPLAY_SERIES[mode]
        : REPEAT_SERIES[mode],
      presentation_group: {
        id: `op01-attention-boundary-v2-${mode}-tp2ep-20261008`,
        label_en: `OP01 Ascend attention boundary ${enabled ? 'ON' : 'OFF'} · vLLM 0.23.0 / Ascend 0.23.0.post1 · TP2+EP · C${concurrency}`,
        label_zh: `OP01 Ascend 注意力边界${enabled ? '开启' : '关闭'} · vLLM 0.23.0 / Ascend 0.23.0.post1 · TP2+EP · C${concurrency}`,
      },
      session_rotation_depth: 1,
    },
    metrics,
    evidence: {
      execution_kind: 'real-online',
      sampling_date_utc: new Date(config.started_at_unix * 1000)
        .toISOString()
        .slice(0, 10),
      sampling_date_source: 'Recorded SWE client started_at_unix converted to UTC',
      status: 'measured',
      profile: 'formal',
      measurement_seconds: 900,
      tuning_complete: false,
      url: 'https://github.com/vLLM-HUST/vllm-hust-website/blob/main/docs/FRONTIER-QWEN35-OP01-ATTENTION-BOUNDARY.md',
      run_ids: [config.run_id],
      aggregation: selected
        ? 'Displayed point is the pre-declared median output-throughput repeat among three valid 900s windows; selected-window latency metrics are retained; all repeats remain as point/run evidence.'
        : 'Valid repeat retained as archived point evidence; not included in the displayed five-point curve because the pre-declared median repeat was selected.',
      benchmark_protocol: {
        protocol_id: 'swe-prefix-reuse/v1',
        campaign: CAMPAIGN,
        repository: BENCHMARK_REPOSITORY,
        revision: BENCHMARK_REVISION,
        revision_status:
          'verified against the measured benchmark source tree; public revision status recorded separately',
        prepared_workload_sha256: config.workload_sha256,
        tokenizer_fingerprint: config.tokenizer.fingerprint,
        duration_seconds: 900,
        concurrency,
        cache_policy: config.cache_policy,
        warmup_policy: 'Separate 20s probe; fresh salts and no primers in the formal window',
        window_policy: config.window_policy,
        acceptance_rule:
          'valid=true, measurement_seconds=900, failed_requests=0, aborted=false, probe and formal protocol checks passed',
        prepared_workload_equivalence: {
          canonical_sha256_after_metadata_normalization: CANONICAL_WORKLOAD_SHA,
          tokenizer_identity_independently_verified: false,
        },
      },
      original_cohort_id: COHORT_ID,
      draft_publication_status: 'published public preview',
      candidate_admission_status:
        'preview: measured source revision and selected raw artifacts are public; checkpoint and tokenizer identity remain incomplete, and non-selected repeat artifacts remain local',
      activation_log: {
        path: relativeTask(logFile),
        point_isolated: true,
        scope: 'One server process for this repeat, including its 20s probe and 900s formal window',
        startup_installed_events: activation.installed,
        all_runtime_effective_events: activation.runtime_effective,
        formal_request_runtime_effective_events:
          activation.formal_request_runtime_effective,
        formal_request_activation_run_ids: activation.formal_request_run_ids,
      },
      runtime_effective: enabled
        ? 'observed during the formal request phase for this ON repeat'
        : 'not observed during the formal request phase; OFF had the plugin disabled',
      repeat_selection: selection,
      repeat_role: selected ? 'selected_median' : 'candidate_retained_archived',
    },
  };
}

function makeRun(candidate, point, mode, concurrency, selection) {
  const { config, summary, metrics, formalDir, probeDir, logFile, formalDirName } =
    candidate;
  const enabled = mode === 'on';
  const probeSummary = readJson(path.join(probeDir, 'summary.json'));
  const activation = activationDetails(logFile);
  return {
    run_id: config.run_id,
    point_id: point.id,
    summary,
    metrics,
    requests_artifact_sha256: sha256(path.join(formalDir, 'requests.jsonl')),
    artifacts: [
      artifact(path.join(formalDir, 'config.json')),
      artifact(path.join(formalDir, 'summary.json')),
      artifact(path.join(formalDir, 'requests.jsonl')),
      artifact(logFile),
      artifact(path.join(probeDir, 'config.json')),
      artifact(path.join(probeDir, 'summary.json')),
      artifact(path.join(probeDir, 'requests.jsonl')),
    ],
    server: serverExtract(config),
    benchmark: {
      repository: BENCHMARK_REPOSITORY,
      protocol: 'swe-prefix-reuse/v1',
      revision: BENCHMARK_REVISION,
      revision_status:
        'verified against the measured benchmark source tree; public revision status recorded separately',
    },
    validation: {
      real_online: true,
      failed_requests: summary.failed_requests,
      raw_metrics_recomputed: true,
      request_protocol_valid: true,
      prompt_id_echo: true,
      output_budgets: true,
      usage_and_done_checks: true,
      prefix_reuse_protocol: true,
      prepared_workload_hash_registered_in_local_draft: true,
      tokenizer_identity_independently_verified: false,
      checkpoint_identity_verified: false,
      activation_log_point_isolated: true,
      performance_attribution_verified: false,
      mod_catalog_registered: true,
      public_raw_evidence_available:
        candidate.run_id === selection.selected_run_id,
      server_log_counts: {
        installed: activation.installed,
        runtime_effective: activation.runtime_effective,
        formal_request_runtime_effective:
          activation.formal_request_runtime_effective,
      },
      patch_requested: enabled,
      runtime_effective_formal_request:
        enabled
          ? activation.formal_request_runtime_effective > 0
          : activation.formal_request_runtime_effective === 0,
      off_definition: enabled
        ? null
        : 'Package installed with VLLM_HUST_ASCEND_ATTENTION_BOUNDARY_ENABLE=0; no formal runtime-effective event is accepted for OFF',
      probe: {
        valid: probeSummary.valid,
        measurement_seconds: probeSummary.measurement_seconds,
        failed_requests: probeSummary.failed_requests,
        aborted: probeSummary.aborted,
        not_a_scored_point: true,
      },
      repeat: {
        repeat_number: candidate.repeat,
        repeat_count: REPEATS,
        formal_directory: formalDirName,
        selection: selection.method,
      },
    },
    activation: {
      installed_events: activation.installed,
      runtime_effective_events: activation.runtime_effective,
      formal_request_runtime_effective_events:
        activation.formal_request_runtime_effective,
      point_isolated: true,
    },
    probe: {
      summary: probeSummary,
      config_path: relativeTask(path.join(probeDir, 'config.json')),
      summary_path: relativeTask(path.join(probeDir, 'summary.json')),
      requests_artifact_sha256: sha256(path.join(probeDir, 'requests.jsonl')),
    },
    client: clientExtract(config),
  };
}

function discoverCandidates(mode, concurrency) {
  const entries = fs.readdirSync(RAW, { withFileTypes: true });
  const pattern = new RegExp(
    `^op01-${mode}-c${concurrency}-r([1-9][0-9]*)-900s$`,
  );
  const candidates = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const match = entry.name.match(pattern);
      if (!match) return null;
      const repeat = Number(match[1]);
      const formalDir = path.join(RAW, entry.name);
      const probeDir = path.join(
        RAW,
        entry.name.replace(/-900s$/, '-probe-20s'),
      );
      const logFile = `${formalDir}.server.log`;
      const config = readJson(path.join(formalDir, 'config.json'));
      const summary = readJson(path.join(formalDir, 'summary.json'));
      if (
        !summary.valid ||
        summary.measurement_seconds !== 900 ||
        summary.failed_requests !== 0 ||
        summary.aborted
      ) {
        throw new Error(`invalid formal result ${entry.name}`);
      }
      if (
        config.concurrency !== concurrency ||
        config.workload_sha256 !== MEASURED_WORKLOAD_SHA ||
        config.server_metadata.mod.enable !== (mode === 'on') ||
        config.server_metadata.mod.source_commit !== MOD_REVISION ||
        config.server_metadata.mod.wheel_sha256 !== MOD_WHEEL_SHA256
      ) {
        throw new Error(`configuration mismatch ${entry.name}`);
      }
      const probeSummary = readJson(path.join(probeDir, 'summary.json'));
      if (
        !probeSummary.valid ||
        probeSummary.measurement_seconds !== 20 ||
        probeSummary.failed_requests !== 0 ||
        probeSummary.aborted
      ) {
        throw new Error(`invalid probe result ${entry.name}`);
      }
      for (const file of [
        path.join(formalDir, 'config.json'),
        path.join(formalDir, 'summary.json'),
        path.join(formalDir, 'requests.jsonl'),
        path.join(probeDir, 'config.json'),
        path.join(probeDir, 'summary.json'),
        path.join(probeDir, 'requests.jsonl'),
        logFile,
      ]) {
        if (!fs.existsSync(file)) throw new Error(`missing evidence file ${file}`);
      }
      return {
        repeat,
        formalDir,
        formalDirName: entry.name,
        probeDir,
        logFile,
        config,
        summary,
        metrics: requestMetrics(path.join(formalDir, 'requests.jsonl'), summary),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.repeat - b.repeat);
  if (candidates.length !== REPEATS) {
    throw new Error(
      `expected ${REPEATS} formal repeats for ${mode} C${concurrency}, found ${candidates.length}`,
    );
  }
  const repeats = new Set(candidates.map((candidate) => candidate.repeat));
  if (repeats.size !== REPEATS || ![1, 2, 3].every((n) => repeats.has(n))) {
    throw new Error(`repeat numbers must be 1,2,3 for ${mode} C${concurrency}`);
  }
  return candidates;
}

function archiveOldOp01(frontier) {
  const oldSeries = new Set([
    'swe-op01-ascend-boundary-off-tp2ep-20261004',
    'swe-op01-ascend-boundary-on-tp2ep-20261004',
  ]);
  const moved = frontier.points.filter((point) =>
    oldSeries.has(point.load?.concurrency_series),
  );
  if (!moved.length) return 0;
  frontier.points = frontier.points.filter(
    (point) => !oldSeries.has(point.load?.concurrency_series),
  );
  frontier.archived_points ||= [];
  const existing = new Set(frontier.archived_points.map((point) => point.id));
  for (const point of moved) {
    if (existing.has(point.id)) continue;
    frontier.archived_points.push({
      ...point,
      display_withdrawal: {
        date: '2026-10-08',
        reason:
          'Superseded by the repeat-backed OP01 campaign using source commit 4a1843d1e2a81f0415a1cfa5141e9b17b3262835; the original f4eacc39 observation is retained unchanged.',
      },
    });
  }
  const cohort = frontier.cohorts.find((item) => item.id === COHORT_ID);
  const series = cohort.workload.contract.display_series_ids;
  cohort.workload.contract.display_series_ids = series
    .filter((id) => !oldSeries.has(id))
    .concat([DISPLAY_SERIES.off, DISPLAY_SERIES.on]);
  return moved.length;
}

function main() {
  const frontierFile = path.join(WEBSITE, 'data', 'leaderboard_frontier.json');
  const evidenceFile = path.join(
    WEBSITE,
    'data',
    'leaderboard_frontier_swe_evidence.json',
  );
  const frontier = readJson(frontierFile);
  const evidence = readJson(evidenceFile);
  const workloadFile = path.join(RAW, 'qwen35.json');
  if (sha256(workloadFile) !== MEASURED_WORKLOAD_SHA) {
    throw new Error(`unexpected workload hash: ${sha256(workloadFile)}`);
  }
  const cohort = frontier.cohorts.find((item) => item.id === COHORT_ID);
  if (!cohort) throw new Error(`missing cohort ${COHORT_ID}`);
  const variants = cohort.workload.contract.prepared_workload_variants || [];
  const variant = variants.find((item) => item.sha256 === MEASURED_WORKLOAD_SHA);
  if (!variant || variant.tokenizer_fingerprint !== MEASURED_TOKENIZER_FINGERPRINT) {
    throw new Error('measured workload/tokenizer variant is not registered');
  }
  const existingPointIds = new Set([
    ...frontier.points.map((point) => point.id),
    ...(frontier.archived_points || []).map((point) => point.id),
  ]);
  const existingRunIds = new Set(evidence.runs.map((run) => run.run_id));
  const selectedPoints = [];
  const archivedCandidates = [];
  const runs = [];
  let discovered = 0;
  for (const mode of ['off', 'on']) {
    for (const concurrency of CONCURRENCIES) {
      const candidates = discoverCandidates(mode, concurrency);
      const selected = [...candidates].sort(
        (a, b) =>
          a.metrics.output_tps - b.metrics.output_tps ||
          a.config.run_id.localeCompare(b.config.run_id),
      )[Math.floor(candidates.length / 2)];
      const selection = selectionRecord(candidates, selected, mode, concurrency);
      for (const candidate of candidates) {
        const point = makePoint(candidate, selection, mode, concurrency);
        const run = makeRun(candidate, point, mode, concurrency, selection);
        if (existingPointIds.has(point.id) || existingRunIds.has(run.run_id)) {
          throw new Error(`OP01 item already exists: ${point.id} / ${run.run_id}`);
        }
        existingPointIds.add(point.id);
        existingRunIds.add(run.run_id);
        runs.push(run);
        discovered += 1;
        if (candidate === selected) selectedPoints.push(point);
        else {
          archivedCandidates.push({
            ...point,
            display_withdrawal: {
              date: '2026-10-08',
              reason:
                'Valid formal repeat retained as evidence; the pre-declared median repeat is the displayed point for this mode/concurrency.',
            },
          });
        }
      }
    }
  }
  const archivedOld = archiveOldOp01(frontier);
  frontier.points.push(...selectedPoints);
  frontier.archived_points ||= [];
  frontier.archived_points.push(...archivedCandidates);
  evidence.runs.push(...runs);
  writeJson(frontierFile, frontier);
  writeJson(evidenceFile, evidence);
  console.log(
    JSON.stringify({
      campaign: CAMPAIGN,
      formal_runs: discovered,
      selected_points: selectedPoints.length,
      archived_repeat_candidates: archivedCandidates.length,
      archived_old_points: archivedOld,
      workload_sha256: MEASURED_WORKLOAD_SHA,
      tokenizer_fingerprint: MEASURED_TOKENIZER_FINGERPRINT,
      mod_revision: MOD_REVISION,
      wheel_sha256: MOD_WHEEL_SHA256,
    }),
  );
}

main();
