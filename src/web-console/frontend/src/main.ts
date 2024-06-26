import { createApp } from "vue";
import router from "./router";
import { createPinia } from "pinia";
import App from "./App.vue";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import "./assets/styles/index.scss";
import 'element-plus/theme-chalk/dark/css-vars.css'
import './assets/styles/css-vars.scss'
import "./permission";

const app = createApp( App );
app.config.warnHandler = () => null;
const pinia = createPinia();
app.use( router )
	.use( pinia )
	.use( ElementPlus )
	.mount( "#app" );
