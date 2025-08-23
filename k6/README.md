# 🚀 K6 Performance Testing Suite

This directory contains a comprehensive performance testing suite for your MiniMeet application using K6. The tests are designed to validate your system's performance, scalability, and reliability under various load conditions.

## 📋 Test Overview

### **Available Tests**

| Test                | Purpose                     | Duration | Max Users  | Description                                                              |
| ------------------- | --------------------------- | -------- | ---------- | ------------------------------------------------------------------------ |
| **Room Capacity**   | Room performance under load | ~15 min  | 100 users  | Tests how many users a single room can hold and how performance degrades |
| **Room Operations** | Realistic user activity     | ~10 min  | 25 users   | Tests room operations, messaging, and media state changes                |
| **Connection Load** | Connection scaling          | ~15 min  | 100 users  | Tests connection establishment and WebSocket scaling                     |
| **Stress Test**     | System breaking points      | ~30 min  | 1500 users | Pushes system to limits, tests error handling and recovery               |

## 🎯 Test Objectives

### **Room Capacity Test**

- **Goal**: Determine maximum users per room
- **Metrics**: Join/leave success rates, response times, performance degradation
- **Stages**: 2 → 5 → 25 → 50 → 75 → 100 users
- **Use Case**: Understanding room scalability limits

### **Room Operations Test**

- **Goal**: Validate room functionality under realistic load
- **Metrics**: Operation success rates, message delivery, media state changes
- **Stages**: 2 → 5 → 25 users
- **Use Case**: Ensuring room features work reliably under load

### **Connection Load Test**

- **Goal**: Test connection handling and WebSocket scaling
- **Metrics**: Connection success rates, latency, concurrent connections
- **Stages**: 2 → 5 → 50 → 100 users
- **Use Case**: Validating WebSocket infrastructure scalability

### **Stress Test**

- **Goal**: Find system breaking points and test recovery
- **Metrics**: Error rates, recovery success, system behavior under extreme load
- **Stages**: 2 → 5 → 200 → 500 → 1000 → 1500 → 100 users
- **Use Case**: Understanding system limits and error handling

## ⚙️ Configuration

### **User Limits (Constants)**

```javascript
USER_LIMITS: {
  MAX_USERS: 1000,           // Maximum users for testing
  MEDIUM_INCREASE: 5,        // Medium user increase
  SMALL_INCREASE: 2,         // Small user increase
  ROOM_CAPACITY: 50,         // Default room capacity
  STRESS_TEST_USERS: 1500,   // Stress test limit
}
```

### **Performance Thresholds**

- **HTTP Response Time**: P95 < 1s, P99 < 2s
- **WebSocket Connection**: P95 < 1s
- **Message Delivery**: P95 < 500ms
- **Error Rate**: < 5% for normal tests, < 20% for stress tests

## 🚀 Getting Started

### **1. Prerequisites**

```bash
# Install K6
# Windows (Chocolatey)
choco install k6

# macOS (Homebrew)
brew install k6

# Linux
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### **2. Verify Installation**

```bash
k6 --version
```

### **3. Start Backend Services**

```bash
# Start all services (make sure Redis is running)
npm run dev:auth
npm run dev:room
npm run dev:signaling
```

### **4. Create Test Users**

```bash
# Run the user creation script
cd k6
node utils/create-test-users.js
```

## 🎬 Running Tests

### **Using the Test Runner (Recommended)**

```bash
cd k6

# Show help and available tests
node run-tests.js --help

# List all tests
node run-tests.js --list

# Run specific test
node run-tests.js room-capacity
node run-tests.js stress-test
```

### **Direct K6 Commands**

```bash
cd k6

# Room capacity test
k6 run scenarios/room-capacity.js

# Room operations test
k6 run scenarios/room-operation.js

# Connection load test
k6 run scenarios/connection-load.js

# Stress test
k6 run scenarios/stress-test.js
```

### **With Custom Output**

```bash
# Save results to JSON file
k6 run --out json=results/room-capacity.json scenarios/room-capacity.js

# Save results to CSV
k6 run --out csv=results/room-capacity.csv scenarios/room-capacity.js

# Multiple output formats
k6 run --out json=results/room-capacity.json --out csv=results/room-capacity.csv scenarios/room-capacity.js
```

## 📊 Understanding Results

### **Key Metrics to Monitor**

#### **Success Rates**

- **Room Join Success**: Should be > 95% for normal tests
- **Connection Success**: Should be > 95% for normal tests
- **Operation Success**: Should be > 90% for normal tests

#### **Response Times**

- **P50**: 50% of requests under this time
- **P90**: 90% of requests under this time
- **P95**: 95% of requests under this time
- **P99**: 99% of requests under this time

#### **Error Rates**

- **Normal Tests**: < 5% error rate
- **Stress Tests**: < 20% error rate (expected to be higher)

### **Interpreting Results**

#### **Good Performance**

- Success rates > 95%
- P95 response times within thresholds
- Error rates < 5%
- Stable performance across user increases

#### **Performance Issues**

- Success rates dropping below 90%
- P95 response times exceeding thresholds
- Error rates > 10%
- Performance degradation with user increases

#### **System Breaking Point**

- Success rates < 50%
- High error rates (> 30%)
- Response times > 10 seconds
- System crashes or unresponsiveness

## 🔧 Customization

### **Modifying User Limits**

Edit `config/test-config.js`:

```javascript
USER_LIMITS: {
  MAX_USERS: 2000,           // Increase for higher capacity testing
  MEDIUM_INCREASE: 10,       // Adjust ramp-up steps
  SMALL_INCREASE: 5,         // Adjust initial load
  ROOM_CAPACITY: 100,        // Match your actual room capacity
  STRESS_TEST_USERS: 3000,   // Increase stress test limit
}
```

### **Adjusting Test Duration**

Edit test stages in scenario files:

```javascript
stages: [
  { duration: '2m', target: 50 }, // Longer ramp-up
  { duration: '5m', target: 50 }, // Longer hold time
  { duration: '1m', target: 0 }, // Faster ramp-down
];
```

### **Customizing Thresholds**

Edit thresholds in test files:

```javascript
thresholds: {
  'room_join_success_rate': [
    { threshold: 'rate > 0.98', abortOnFail: false }, // Stricter success rate
  ],
  'room_performance_trend': [
    { threshold: 'p(95) < 1000', abortOnFail: false }, // Stricter response time
  ],
}
```

## 🐛 Troubleshooting

### **Common Issues**

#### **K6 Not Found**

```bash
# Check if K6 is in PATH
which k6  # Linux/macOS
where k6  # Windows

# Reinstall K6 if needed
# Windows: choco install k6
# macOS: brew install k6
# Linux: Follow installation guide
```

#### **Backend Services Unreachable**

```bash
# Check if services are running
curl http://localhost:5001  # Auth service
curl http://localhost:5002  # Room service
curl http://localhost:5003  # Signaling service

# Start services if needed
npm run dev:auth
npm run dev:room
npm run dev:signaling
```

#### **Redis Connection Issues**

```bash
# Check if Redis is running
redis-cli ping  # Should return PONG

# Start Redis if needed
redis-server
```

#### **Test Users Not Created**

```bash
# Check if users exist in database
# Or recreate test users
cd k6
node utils/create-test-users.js
```

### **Performance Issues**

#### **High Error Rates**

- Check backend service logs
- Verify Redis connection
- Check database performance
- Monitor system resources (CPU, memory, network)

#### **Slow Response Times**

- Check database query performance
- Verify Redis cache hit rates
- Monitor WebSocket connection health
- Check network latency

#### **Connection Failures**

- Verify WebSocket server capacity
- Check authentication service health
- Monitor Redis connection pool
- Verify load balancer configuration

## 📈 Best Practices

### **Test Execution**

1. **Start Small**: Begin with small user counts and gradually increase
2. **Monitor Resources**: Watch CPU, memory, and network usage during tests
3. **Check Logs**: Monitor backend service logs for errors
4. **Validate Results**: Ensure test results make sense for your system

### **Test Planning**

1. **Define Goals**: What performance characteristics do you want to validate?
2. **Set Baselines**: Establish current performance baselines
3. **Plan Scenarios**: Choose appropriate test scenarios for your goals
4. **Set Thresholds**: Define acceptable performance thresholds

### **Result Analysis**

1. **Compare Baselines**: Compare results against established baselines
2. **Identify Bottlenecks**: Look for performance degradation patterns
3. **Validate Assumptions**: Ensure results align with expected behavior
4. **Document Findings**: Record insights and recommendations

## 🔮 Future Enhancements

### **Planned Features**

- **Real-time Monitoring**: Live dashboard during test execution
- **Automated Analysis**: AI-powered result interpretation
- **Custom Scenarios**: User-defined test scenarios
- **Integration Testing**: End-to-end workflow testing
- **Mobile Testing**: Mobile app performance validation

### **Advanced Metrics**

- **Business Metrics**: User engagement, conversion rates
- **Infrastructure Metrics**: Server resource utilization
- **Network Metrics**: Bandwidth, latency, packet loss
- **Security Metrics**: Authentication success, authorization failures

## 📞 Support

### **Getting Help**

- Check this README for common issues
- Review K6 documentation: https://k6.io/docs/
- Check backend service logs for errors
- Monitor system resources during tests

### **Contributing**

- Report bugs and issues
- Suggest new test scenarios
- Improve documentation
- Optimize test performance

---

**Happy Testing! 🚀**

Your K6 performance testing suite is now ready to help you validate your MiniMeet application's scalability and reliability.

