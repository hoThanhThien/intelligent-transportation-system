<template>
  <div id="app">
    <router-view />
  </div>
</template>

<style>
/* Nền xanh dương full màn hình */
html, body {
  height: 100%;
  margin: 0;
}

#app {
  min-height: 100vh;
  background-color: #02327a; 
  color: #fff; 
}
</style>
