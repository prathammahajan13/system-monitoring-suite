const { SystemMonitor } = require('@prathammahajan/system-monitoring-suite');

// Create a comprehensive example demonstrating all features
async function runComprehensiveExample() {
  console.log('🚀 Starting Comprehensive System Monitoring Suite Example\n');

  // 1. Basic Configuration
  const config = {
    interval: 2000, // 2 seconds for demo
    enabled: true,
    debug: true,
    logLevel: 'info',
    environment: 'development'
  };

  console.log('📋 Configuration:', JSON.stringify(config, null, 2));
  console.log('');

  // 2. Initialize SystemMonitor
  const monitor = new SystemMonitor(config);
  console.log('✅ SystemMonitor initialized');

  // 3. Set up event listeners
  monitor.on('started', () => {
    console.log('🎯 Monitor started successfully');
  });

  monitor.on('stopped', () => {
    console.log('🛑 Monitor stopped');
  });

  monitor.on('metricsCollected', (metrics) => {
    console.log(`📊 Metrics collected: CPU: ${metrics.cpu.usage.toFixed(1)}%, Memory: ${metrics.memory.usage.toFixed(1)}%, Disk: ${metrics.disk.usage.toFixed(1)}%`);
  });

  monitor.on('error', (error) => {
    console.error('❌ Error occurred:', error.message);
  });

  monitor.on('configUpdated', (newConfig) => {
    console.log('⚙️ Configuration updated');
  });

  // 4. Start monitoring
  console.log('🔄 Starting monitoring...');
  await monitor.start();

  // 5. Let it run for a while and collect metrics
  console.log('⏳ Collecting metrics for 10 seconds...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // 6. Get current status
  const status = monitor.getStatus();
  console.log('\n📈 Current Status:');
  console.log(`   Running: ${status.isRunning}`);
  console.log(`   Uptime: ${(status.uptime / 1000).toFixed(1)}s`);
  console.log(`   Metrics Collected: ${status.metricsCount}`);
  console.log(`   Alerts Generated: ${status.alertsCount}`);

  // 7. Get recent metrics
  const recentMetrics = monitor.getMetrics();
  console.log(`\n📊 Recent Metrics (${recentMetrics.length} samples):`);
  recentMetrics.slice(-5).forEach((metric, index) => {
    const time = new Date(metric.timestamp).toLocaleTimeString();
    console.log(`   ${index + 1}. [${time}] CPU: ${metric.cpu.usage.toFixed(1)}%, Memory: ${metric.memory.usage.toFixed(1)}%, Disk: ${metric.disk.usage.toFixed(1)}%`);
  });

  // 8. Get metrics for specific time range
  const now = Date.now();
  const fiveSecondsAgo = now - 5000;
  const recentMetricsRange = monitor.getMetrics({ from: fiveSecondsAgo, to: now });
  console.log(`\n⏰ Metrics from last 5 seconds: ${recentMetricsRange.length} samples`);

  // 9. Update configuration
  console.log('\n⚙️ Updating configuration...');
  monitor.updateConfig({
    interval: 1000, // Change to 1 second
    debug: false
  });

  // 10. Let it run with new config
  console.log('⏳ Running with new config for 5 seconds...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // 11. Health check
  console.log('\n🏥 Performing health check...');
  const health = await monitor.healthCheck();
  console.log('Health Status:', JSON.stringify(health, null, 2));

  // 12. Get final metrics summary
  const finalMetrics = monitor.getMetrics();
  if (finalMetrics.length > 0) {
    const cpuValues = finalMetrics.map(m => m.cpu.usage);
    const memoryValues = finalMetrics.map(m => m.memory.usage);
    const diskValues = finalMetrics.map(m => m.disk.usage);

    const avgCpu = cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length;
    const avgMemory = memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length;
    const avgDisk = diskValues.reduce((a, b) => a + b, 0) / diskValues.length;

    const maxCpu = Math.max(...cpuValues);
    const maxMemory = Math.max(...memoryValues);
    const maxDisk = Math.max(...diskValues);

    console.log('\n📊 Metrics Summary:');
    console.log(`   Total Samples: ${finalMetrics.length}`);
    console.log(`   Average CPU: ${avgCpu.toFixed(1)}% (Max: ${maxCpu.toFixed(1)}%)`);
    console.log(`   Average Memory: ${avgMemory.toFixed(1)}% (Max: ${maxMemory.toFixed(1)}%)`);
    console.log(`   Average Disk: ${avgDisk.toFixed(1)}% (Max: ${maxDisk.toFixed(1)}%)`);
  }

  // 13. Stop monitoring
  console.log('\n🛑 Stopping monitoring...');
  await monitor.stop();

  // 14. Final status
  const finalStatus = monitor.getStatus();
  console.log('\n🏁 Final Status:');
  console.log(`   Running: ${finalStatus.isRunning}`);
  console.log(`   Total Metrics Collected: ${finalStatus.metricsCount}`);
  console.log(`   Total Runtime: ${(finalStatus.uptime / 1000).toFixed(1)}s`);

  console.log('\n✅ Comprehensive example completed successfully!');
  console.log('\n🎉 The @pm/system-monitoring-suite package is working perfectly!');
}

// Run the example
runComprehensiveExample().catch(console.error);
