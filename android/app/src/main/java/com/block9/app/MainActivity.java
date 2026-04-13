package com.block9.app;

import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
	private static final long NAV_HIDE_DELAY_MS = 1800;

	private final Handler immersiveHandler = new Handler(Looper.getMainLooper());
	private final Runnable hideNavRunnable = this::applyImmersiveNavigation;

	@Override
	protected void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
		scheduleNavigationHide();
	}

	@Override
	protected void onResume() {
		super.onResume();
		scheduleNavigationHide();
	}

	@Override
	protected void onPause() {
		immersiveHandler.removeCallbacks(hideNavRunnable);
		super.onPause();
	}

	@Override
	public void onWindowFocusChanged(boolean hasFocus) {
		super.onWindowFocusChanged(hasFocus);
		if (hasFocus) {
			scheduleNavigationHide();
		}
	}

	@Override
	public void onUserInteraction() {
		super.onUserInteraction();
		scheduleNavigationHide();
	}

	private void scheduleNavigationHide() {
		immersiveHandler.removeCallbacks(hideNavRunnable);
		immersiveHandler.postDelayed(hideNavRunnable, NAV_HIDE_DELAY_MS);
	}

	private void applyImmersiveNavigation() {
		Window window = getWindow();
		if (window == null) return;

		if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
			WindowInsetsController controller = window.getInsetsController();
			if (controller != null) {
				controller.hide(WindowInsets.Type.navigationBars());
				controller.setSystemBarsBehavior(
						WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
				);
			}
			return;
		}

		View decorView = window.getDecorView();
		decorView.setSystemUiVisibility(
				View.SYSTEM_UI_FLAG_LAYOUT_STABLE
						| View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
						| View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
						| View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
		);
	}
}
