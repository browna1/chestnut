(function initRuntimeConfig() {
  var host = window.location.hostname;
  var isLocal = host === 'localhost' || host === '127.0.0.1';

  window.__CHESTNUT_CONFIG__ = {
    // 本地开发默认用本地后端
    // 部署到 GitHub Pages 后，把下面 productionApi 改成你的线上后端地址
    productionApi: 'https://chestnut-life-api.onrender.com/api',
    localApi: 'http://localhost:4000/api',
    get apiBase() {
      return isLocal ? this.localApi : this.productionApi;
    }
  };
})();
