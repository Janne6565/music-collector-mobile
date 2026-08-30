import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/store/authSlice";
import { scanReducer } from "@/store/scanSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    scan: scanReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
