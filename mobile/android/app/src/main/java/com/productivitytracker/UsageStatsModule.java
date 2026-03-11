package com.productivitytracker;

import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.provider.Settings;
import android.app.AppOpsManager;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

import java.util.List;
import java.util.SortedMap;
import java.util.TreeMap;

public class UsageStatsModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext context;

    UsageStatsModule(ReactApplicationContext context) {
        super(context);
        this.context = context;
    }

    @Override
    public String getName() {
        return "UsageStats";
    }

    @ReactMethod
    public void hasPermission(Promise promise) {
        try {
            AppOpsManager appOps = (AppOpsManager) context.getSystemService(Context.APP_OPS_SERVICE);
            int mode = appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                android.os.Process.myUid(),
                context.getPackageName()
            );
            promise.resolve(mode == AppOpsManager.MODE_ALLOWED);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void requestPermission() {
        Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
    }

    @ReactMethod
    public void getForegroundApp(Promise promise) {
        try {
            UsageStatsManager usm = (UsageStatsManager) context.getSystemService(Context.USAGE_STATS_SERVICE);
            long now = System.currentTimeMillis();
            // Query last 5 seconds of usage
            List<UsageStats> stats = usm.queryUsageStats(
                UsageStatsManager.INTERVAL_BEST,
                now - 5000,
                now
            );

            if (stats == null || stats.isEmpty()) {
                promise.resolve(null);
                return;
            }

            // Find the most recently used app
            SortedMap<Long, UsageStats> sortedMap = new TreeMap<>();
            for (UsageStats usageStats : stats) {
                sortedMap.put(usageStats.getLastTimeUsed(), usageStats);
            }

            if (!sortedMap.isEmpty()) {
                UsageStats recent = sortedMap.get(sortedMap.lastKey());
                WritableMap result = Arguments.createMap();
                result.putString("packageName", recent.getPackageName());
                result.putDouble("lastTimeUsed", recent.getLastTimeUsed());
                result.putDouble("totalTimeInForeground", recent.getTotalTimeInForeground());
                promise.resolve(result);
            } else {
                promise.resolve(null);
            }
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }
}
