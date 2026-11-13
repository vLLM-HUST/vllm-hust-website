# 固定参考 Engine 一键引导脚本

本脚本只复跑已冻结的参考 Engine 组合，不会自动装载任意 MOD。评估待测 MOD 时，请在执行指南中选择默认的 MOD 流程，使用项目实际执行器。

`one_click.py` 是公开 benchmark 中 `engine_bootstrap.py` 的逐字节副本，仅改下载文件名。

- 固定来源：[vllm-hust-benchmark / engine_bootstrap.py](https://github.com/vLLM-HUST/vllm-hust-benchmark/blob/80e7efc9f7357bafb5ea502fe0838c340def5092/scripts/third_party_self_run/engine_bootstrap.py)
- 目标 Engine 提交：`448362c7565597c8963c970dcfea0b235fd5fcf7` <!-- pragma: allowlist secret -->
- 文件 SHA256 见同页下载的 AI 提示词；按钮在保存前检查文件大小、SHA256 与协议绑定。
- [完整标准与执行指南](https://vllm-hust.sage.org.ai/dataset-standard.html)

在独立目录保存此脚本，准备 Python 3.11+、双卡 Ascend 910B2、模型权重及固定 B1 SDK。 首次恢复 Engine 需要具备私有固定附件读取权的 `GH_TOKEN` /
`GITHUB_TOKEN`，或通过 `--env-file` 指定凭据文件；不要将凭据写进脚本或公开报告。脚本校验固定工具包与文件清单后，将参数和退出信号交给 Engine 执行器。

替换路径与物理卡号，使用全新结果目录：

```bash
python one_click.py \
  --model /path/to/model \
  --out /path/to/new-results \
  --b1-python /path/to/fixed-b1-sdk/bin/python \
  --physical-devices 0,1 \
  --datasets mmlu,hle,frontier,swe,terminal
```

快速检查仅将 `--datasets` 改为 `mmlu`，不能替代五项完整测试。首次在本机执行须重新取得 C8 资格。 下载脚本或执行 `--help` 不代表完成环境准备、推理测试或目标验收。
