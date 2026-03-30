// Test all NVIDIA models by sending a minimal chat completion request
import 'dotenv/config'

const BASE_URL = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1'
const API_KEY = process.env.NVIDIA_API_KEY || ''

const MODELS = [
  // GLM
  { label: "GLM-5", modelID: "z-ai/glm5" },
  { label: "GLM-4.7", modelID: "z-ai/glm4.7" },
  // Kimi
  { label: "Kimi K2.5", modelID: "moonshotai/kimi-k2-5" },
  { label: "Kimi K2 Instruct", modelID: "moonshotai/kimi-k2-instruct" },
  { label: "Kimi K2 Instruct 0905", modelID: "moonshotai/kimi-k2-instruct-0905" },
  // Qwen
  { label: "Qwen3 Next 80B", modelID: "qwen/qwen3-next-80b-a3b-instruct" },
  { label: "Qwen3.5 397B", modelID: "qwen/qwen3-5-397b-a17b" },
  { label: "Qwen3.5 122B", modelID: "qwen/qwen3-5-122b-a10b" },
  // DeepSeek
  { label: "DeepSeek V3.2", modelID: "deepseek-ai/deepseek-v3_2" },
  { label: "DeepSeek V3.1", modelID: "deepseek-ai/deepseek-v3_1" },
  { label: "DeepSeek V3.1 Terminus", modelID: "deepseek-ai/deepseek-v3_1-terminus" },
  // NVIDIA / Nemotron
  { label: "Nemotron 120B Super", modelID: "nvidia/nemotron-3-super-120b-a12b" },
  { label: "Nemotron 30B Nano", modelID: "nvidia/nemotron-3-nano-30b-a3b" },
  { label: "Llama Nemotron Ultra 253B", modelID: "nvidia/llama-3.1-nemotron-ultra-253b-v1" },
  { label: "Llama Nemotron 70B Reward", modelID: "nvidia/llama-3.1-nemotron-70b-reward" },
  { label: "Nemotron Mini 4B", modelID: "nvidia/nemotron-mini-4b-instruct" },
  { label: "Nemotron Embed 1B", modelID: "nvidia/llama-nemotron-embed-1b-v2" },
  { label: "Nemotron Rerank 1B", modelID: "nvidia/llama-nemotron-rerank-1b-v2" },
  // Meta Llama
  { label: "Llama 3.3 70B", modelID: "meta/llama-3.3-70b-instruct" },
  { label: "Llama 3.1 70B", modelID: "meta/llama-3.1-70b-instruct" },
  { label: "Llama 3.1 8B", modelID: "meta/llama-3.1-8b-instruct" },
  // OpenAI OSS
  { label: "GPT-OSS 120B", modelID: "openai/gpt-oss-120b" },
  { label: "GPT-OSS 20B", modelID: "openai/gpt-oss-20b" },
  // MiniMax
  { label: "MiniMax M2.5", modelID: "minimaxai/minimax-m2.5" },
  // StepFun
  { label: "StepFun Step 3.5 Flash", modelID: "stepfun-ai/step-3.5-flash" },
  // Microsoft
  { label: "Phi 3.5 Mini", modelID: "microsoft/phi-3_5-mini" },
]

async function testModel(model) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: model.modelID,
        messages: [{ role: 'user', content: 'Say hi in one word.' }],
        max_tokens: 16,
        stream: false,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!res.ok) {
      const body = await res.text()
      let detail = ''
      try {
        const j = JSON.parse(body)
        detail = j.detail || j.error?.message || body.slice(0, 120)
      } catch { detail = body.slice(0, 120) }
      return { ...model, status: 'FAIL', httpCode: res.status, error: detail }
    }

    const data = await res.json()
    const reply = data.choices?.[0]?.message?.content?.slice(0, 60) || '(empty)'
    return { ...model, status: 'OK', reply }
  } catch (err) {
    clearTimeout(timeout)
    return { ...model, status: 'FAIL', httpCode: 0, error: err.message?.slice(0, 100) }
  }
}

async function main() {
  console.log(`\nTesting ${MODELS.length} models against ${BASE_URL}`)
  console.log(`API Key: ${API_KEY.slice(0, 12)}...${API_KEY.slice(-4)}\n`)
  console.log('='.repeat(90))

  const results = []
  for (const model of MODELS) {
    process.stdout.write(`Testing: ${model.label.padEnd(30)}`)
    const result = await testModel(model)
    if (result.status === 'OK') {
      console.log(`✅ OK  → "${result.reply}"`)
    } else {
      console.log(`❌ FAIL (${result.httpCode}) → ${result.error}`)
    }
    results.push(result)
  }

  console.log('\n' + '='.repeat(90))
  const working = results.filter(r => r.status === 'OK')
  const broken = results.filter(r => r.status === 'FAIL')
  
  console.log(`\n✅ Working: ${working.length}/${MODELS.length}`)
  working.forEach(r => console.log(`   ${r.label} (${r.modelID})`))
  
  console.log(`\n❌ Broken: ${broken.length}/${MODELS.length}`)
  broken.forEach(r => console.log(`   ${r.label} (${r.modelID}) → ${r.httpCode}: ${r.error}`))
}

main()
