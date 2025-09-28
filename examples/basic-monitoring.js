const { SystemMonitor } = require('@prathammahajan/system-monitoring-suite');

async function basicMonitoring() {
  console.log('Starting basic system monitoring...');

  // Create a monitor with default configuration
  const monitor = new SystemMonitor({
    interval: 5000, // 5 seconds
    debug: true,
    logLevel: 'info'
  });

  // Set up event listeners
  monitor.on('started', () => {
    console.log('✅ Monitoring started successfully');
  });

  monitor.on('stopped', () => {
    console.log('⏹️ Monitoring stopped');
  });

  monitor.on('metricsCollected', (metrics) => {
    console.log('📊 New metrics collected:');
    console.log(`   CPU: ${metrics.cpu.usage.toFixed(1)}%`);
    console.log(`   Memory: ${metrics.memory.usage.toFixed(1)}%`);
    console.log(`   Disk: ${metrics.disk.usage.toFixed(1)}%`);
    console.log(`   Network: ${metrics.network.interfaces[0]?.bytesReceived || 0} bytes`);
  });

  monitor.on('alert', (alert) => {
    console.log('🚨 Alert triggered:');
    console.log(`   Metric: ${alert.metric}`);
    console.log(`   Severity: ${alert.severity}`);
    console.log(`   Message: ${alert.message}`);
  });

  // Get analysis after collecting some metrics
  setTimeout(() => {
    const analysis = monitor.getAnalysis();
    if (analysis) {
      console.log('📈 Performance analysis:');
      console.log(`   Overall Health: ${analysis.summary.overallHealth}`);
      console.log(`   Score: ${analysis.summary.score}/100`);
      console.log(`   Key Issues: ${analysis.summary.keyIssues.length}`);
      console.log(`   Recommendations: ${analysis.summary.recommendations.length}`);
    }
  }, 10000);

  monitor.on('error', (error) => {
    console.error('❌ Monitoring error:', error.message);
  });

  try {
    // Start monitoring
    await monitor.start();

    // Monitor for 2 minutes
    console.log('Monitoring for 2 minutes...');
    await new Promise(resolve => setTimeout(resolve, 2 * 60 * 1000));

    // Get final status
    const status = monitor.getStatus();
    console.log('📋 Final status:');
    console.log(`   Running: ${status.isRunning}`);
    console.log(`   Uptime: ${Math.round(status.uptime / 1000)}s`);

    // Stop monitoring
    await monitor.stop();

  } catch (error) {
    console.error('Failed to start monitoring:', error.message);
    process.exit(1);
  }
}

// Run the example
if (require.main === module) {
  basicMonitoring().catch(console.error);
}

module.exports = { basicMonitoring };
