// 自定义签名脚本 - 在 Linux 上跳过代码签名
// Custom signing script - Skip code signing on Linux

async function customSign(configuration) {
  console.log('✓ 跳过代码签名 (Skip code signing on Linux)');
  // 在 Linux 上不进行签名，直接返回
  return null;
}

module.exports = customSign;
