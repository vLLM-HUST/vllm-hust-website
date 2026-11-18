# 产品论文整理与来源

这是产品页的文献引用与编辑说明，不是实验结果或产品能力验收记录。题录来源：

- [个人主页完整题录](https://github.com/ShuhaoZhangTony/shuhaozhangtony.github.io/blob/1afc79099c190cfaf19cd2ca3ea56cdcb51f3914/contents/publications.md)。
- [研究摘要索引](https://github.com/ShuhaoZhangTony/shuhaozhangtony.github.io/blob/1afc79099c190cfaf19cd2ca3ea56cdcb51f3914/contents/research_papers/publications_summary.md)。
- [系统与代表成果归类](https://github.com/ShuhaoZhangTony/shuhaozhangtony.github.io/blob/1afc79099c190cfaf19cd2ca3ea56cdcb51f3914/contents/systems.md)。
- 固定提交：`1afc79099c190cfaf19cd2ca3ea56cdcb51f3914`；核对日期：2026-11-18。

核对完整题录 65 项，将 56 项相关工作逐条列入 Engine、Control Plane、Continuum
页面。同一论文可关联多个产品，在每个产品页只列一次。研究论文、综述、Vision、Demo 与已接收工作保留身份；论文相关性不等于实现已纳入当前产品。旧论文作为硬件、并发与状态处理的研究基础分组列出。

PDF 使用该固定提交的作者版路径，已核对 Git 树文件存在；未提供作者版的条目使用正式论文页或题录，不拼造下载地址。年份采用核准题录与下载标签，不能从归档目录推定：Melia 为 TPDS
2016，Co-Run Study 为 TPDS 2017（online 2016），Select Edges Wisely 为 PVLDB 2025，Data-Aware Adaptive
Compression 为 TKDE 2024。Adaptive Sampling 保留 PACMMOD 2024 / SIGMOD 2025 双重信息。

## 完整覆盖核对

| 论文                                                                                                               | 年份 | 产品页或未列入原因                                         |
| ------------------------------------------------------------------------------------------------------------------ | ---- | ---------------------------------------------------------- |
| BidKV: Utility-Guided Preemption Scheduling for KV-Pressure LLM Serving                                            | 2026 | engine                                                     |
| BidKV：显存受限推理的 KV 缓存回收机制                                                                              | 2026 | engine                                                     |
| SAGE: A Dataflow-Native Framework for Modular, Controllable, and Transparent LLM-Augmented Reasoning               | 2026 | control-plane                                              |
| Demonstrating SAGE: A Dataflow-Native Framework for Modular, Controllable, and Transparent LLM-Augmented Reasoning | 2026 | control-plane                                              |
| BriskSnapshot: A Live Demo of Join-Backed Semantic Windows for Streaming AI Pipelines                              | 2026 | control-plane, continuum                                   |
| Towards High-Performance Transactional Stateful Serverless Workflows with Affinity-Aware Leasing                   | 2025 | control-plane, continuum                                   |
| Spacker: Unified State Migration for Distributed Streaming                                                         | 2025 | control-plane, continuum                                   |
| Scalable Transactional Stream Processing on Multicore Processors                                                   | 2025 | engine, control-plane, continuum                           |
| MorphStream: Scalable Processing of Transactions over Streams                                                      | 2024 | engine, control-plane, continuum                           |
| A Survey on Transactional Stream Processing                                                                        | 2024 | engine, control-plane, continuum                           |
| Fast Parallel Recovery for Transactional Stream Processing on Multicores                                           | 2024 | engine, control-plane, continuum                           |
| MorphStream: Adaptive Scheduling for Scalable Transactional Stream Processing on Multicores                        | 2023 | engine, control-plane, continuum                           |
| Towards Concurrent Stateful Stream Processing on Multicore Processors                                              | 2020 | engine, control-plane, continuum                           |
| Multi-Query Optimization for Complex Event Processing in SAP ESP                                                   | 2017 | control-plane, continuum                                   |
| Revisiting the Design of Parallel Stream Joins on Trusted Execution Environments                                   | 2022 | engine                                                     |
| In-Cache Query Co-Processing on Coupled CPU/GPU Architectures                                                      | 2014 | engine                                                     |
| OmniDB: Towards Portable and Efficient Query Processing on Parallel CPU/GPU Architectures                          | 2013 | engine                                                     |
| ComStar: Compression-Aware Stream Query for Heterogeneous Hybrid Architecture                                      | 2026 | engine                                                     |
| Neuromem: A Granular Decomposition of the Streaming Lifecycle in External Memory for LLMs                          | 2026 | continuum                                                  |
| GRACE: Alleviating Reconstruction Cost in Dynamic Graph Processing Systems                                         | 2026 | continuum                                                  |
| Scalable Online Interval Join on Modern Multicore Processors in OpenMLDB                                           | 2023 | engine, continuum                                          |
| Parallelizing Intra-Window Join on Multicores: An Experimental Study                                               | 2021 | engine, continuum                                          |
| BriskStream: Scaling Data Stream Processing on Shared-Memory Multicore Architectures                               | 2019 | engine, control-plane                                      |
| Revisiting the Design of Data Stream Processing Systems on Multi-Core Processors                                   | 2017 | engine, control-plane                                      |
| Data-Aware Adaptive Compression for Stream Processing                                                              | 2024 | engine                                                     |
| MAST: Towards Efficient Analytical Query Processing on Point Cloud Data                                            | 2025 | 点云分析查询；与当前三个产品的研究主题联系较弱。           |
| LibAMM: Empirical Insights into Approximate Computing for Accelerating Matrix Multiplication                       | 2024 | engine                                                     |
| PECJ: Stream Window Join on Disorder Data Streams with Proactive Error Compensation                                | 2024 | continuum                                                  |
| CStream: Parallel Data Stream Compression on Multicore Edge Devices                                                | 2024 | engine                                                     |
| Predictive and Near-Optimal Sampling for View Materialization in Video Databases                                   | 2024 | 视频数据库物化视图采样；与当前三个产品的研究主题联系较弱。 |
| Parallelizing Stream Compression for IoT Applications on Asymmetric Multicores                                     | 2023 | engine                                                     |
| CompressStreamDB: Fine-Grained Adaptive Stream Processing without Decompression                                    | 2023 | engine, continuum                                          |
| Fine-Grained Multi-Query Stream Processing on Integrated Architectures                                             | 2021 | engine                                                     |
| FineStream: Fine-Grained Window-Based Stream Processing on CPU-GPU Integrated Architectures                        | 2020 | engine                                                     |
| Select Edges Wisely: Monotonic Path Aware Graph Layout Optimization for Disk-Based ANN Search                      | 2025 | continuum                                                  |
| PREACT: Predictive Resource Allocation for Bursty Workloads in a Co-located Data Center                            | 2024 | control-plane                                              |
| Low-Latency Video Conferencing via Optimized Packet Routing and Reordering                                         | 2024 | 视频会议网络；未列为当前产品的推理调度机制。               |
| Understanding Co-Running Behaviors on Integrated CPU/GPU Architectures                                             | 2017 | engine                                                     |
| Elastic Multi-resource Fairness: Balancing Fairness and Efficiency in Coupled CPU/GPU Architectures                | 2016 | engine, control-plane                                      |
| Melia: A MapReduce Framework on OpenCL-Based FPGAs                                                                 | 2016 | engine                                                     |
| BriskSeed: Online History-Guided Reuse for Accelerating Dynamic Approximate Nearest Neighbor Search                | 2027 | continuum                                                  |
| ActiShade: Activating Overshadowed Knowledge to Guide Multi-Hop Reasoning in Large Language Models                 | 2026 | continuum                                                  |
| Enabling Adaptive Sampling for Intra-Window Join: Simultaneously Optimizing Quantity and Quality                   | 2024 | engine                                                     |
| Scalable Machine Learning for Real-Time Fault Diagnosis in Industrial IoT Cooling Roller Systems (SRTFD)           | 2025 | 工业设备故障诊断应用；未列为当前产品论文。                 |
| SentiStream: A Co-Training Framework for Adaptive Online Sentiment Analysis in Evolving Data Streams               | 2023 | continuum                                                  |
| MOStream: A Modular and Self-Optimizing Data Stream Clustering Algorithm                                           | 2024 | continuum                                                  |
| Data Stream Clustering: An In-depth Empirical Study                                                                | 2023 | continuum                                                  |
| Ferret: An Efficient Online Continual Learning Framework under Varying Memory Constraints                          | 2025 | continuum                                                  |
| StreamFP: Fingerprint-guided Data Selection for Efficient Stream Learning                                          | 2026 | continuum                                                  |
| A Framework of Knowledge Graph-Enhanced Large Language Model Based on Question Decomposition and Atomic Retrieval  | 2024 | continuum                                                  |
| A Framework of Knowledge Graph-Enhanced Large Language Model Based on Global Planning                              | 2026 | continuum                                                  |
| FlowRAG: Continual Learning for Dynamic Retriever in Retrieval-Augmented Generation                                | 2026 | continuum                                                  |
| CANDOR-Bench: Benchmarking In-Memory Continuous ANNS under Dynamic Open-World Streams [Experiments & Analysis]     | 2026 | continuum                                                  |
| Multi-Hop Knowledge Editing via Critic-Guided Multi-Agent Reasoning                                                | 2026 | continuum                                                  |
| FusionFlow: Enabling Deep Structural Exploration for Automated Agentic Workflow Generation                         | 2026 | control-plane                                              |
| Detecting Hallucination in Large Language Models through Deep Internal Representation Analysis                     | 2025 | continuum                                                  |
| MatSwarm: Trusted Swarm Transfer Learning Driven Materials Computation for Secure Big Data Sharing                 | 2024 | 材料计算与迁移学习应用；未列为当前产品论文。               |
| Payment Behavior Prediction on Shared Parking Lots with TR-GCN                                                     | 2022 | 停车行为预测应用。                                         |
| Periodic Weather-Aware LSTM with Event Mechanism for Parking Behavior Prediction                                   | 2022 | 停车行为预测应用。                                         |
| PewLSTM: Periodic LSTM with Weather-Aware Gating Mechanism for Parking Behavior Prediction                         | 2020 | 停车行为预测应用。                                         |
| A Hardware-Conscious Stateful Stream Compression Framework for IoT Applications (Vision)                           | 2023 | engine                                                     |
| Hardware-Conscious Stream Processing: A Survey                                                                     | 2019 | engine, control-plane                                      |
| NebulaStream: Complex Analytics Beyond the Cloud                                                                   | 2020 | control-plane, continuum                                   |
| TraV: An Interactive Exploration System for Massive Trajectory Data                                                | 2019 | 轨迹可视探索应用。                                         |
| To Co-run, or Not to Co-run: A Performance Study on Integrated Architectures                                       | 2015 | engine                                                     |

代码链接中的 MorphStream 与 CStream 已按 GitHub 仓库 ID 核对迁移至 DataSysResearch，分别保持 ID 274399395 和
444991113，均为公开仓库。

## 后续更新

先核对个人主页新提交、题录、核准年份、接收状态与实际 PDF 路径，再更新三个产品页的 `PRODUCT PUBLICATIONS`
区块和本覆盖表。新增条目沿用共享样式与原生引用详情，避免把论文中的性能提升写成当前冻结引擎的实测结果。执行既有产品主页浏览器回归；保留不同产品的负责人、安装、MOD 和评测入口。
