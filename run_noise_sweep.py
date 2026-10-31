import numpy as np
import pandas as pd

np.random.seed(42)
eps_values = [0.1, 0.25, 0.5, 1.0, 2.0, 5.0]
num_samples = 100000
true_N = 1000

results = []

for eps in eps_values:
    # Scale parameter b = 1 / epsilon
    b = 1.0 / eps
    # Draw Laplace noise variates
    u = np.random.uniform(-0.5, 0.5, num_samples)
    noise = -b * np.sign(u) * np.log(1.0 - 2.0 * np.abs(u))
    noisy_Y = np.maximum(0, np.round(true_N + noise))
    
    mae = np.mean(np.abs(noisy_Y - true_N))
    rmse = np.sqrt(np.mean((noisy_Y - true_N) ** 2))
    
    results.append({'epsilon': eps, 'mae': round(mae, 3), 'rmse': round(rmse, 3)})
    print(f"Epsilon: {eps:<5} | MAE: {mae:.3f} | RMSE: {rmse:.3f}")

df = pd.DataFrame(results)
df[['epsilon', 'mae']].to_csv('results/fig_privutil.csv', index=False)
print("Saved results/fig_privutil.csv successfully.")