from plyfile import PlyData, PlyElement
import numpy as np

# =========================
# 設定
# =========================
input_ply  = "point_cloud.ply"
output_ply = "point_cloud_alpha_voxel_200k.ply"

# α（重要度）関連
alpha_threshold = 0.04      # 最低限残すα
alpha_split     = 0.10      # 高α・低αの分岐

# ボクセルサイズ
base_voxel_size = 0.005     # 基準
low_alpha_scale  = 2.5      # 低αは荒く
high_alpha_scale = 0.8      # 高αは細かく

# 最終目標点数
target_points = 200_000

# =========================
# 読み込み
# =========================
ply = PlyData.read(input_ply)
data = np.array(ply.elements[0].data)

print("元点数:", len(data))
print("プロパティ一覧:", data.dtype.names)

# =========================
# αプロパティ検出
# =========================
alpha_name_candidates = ["alpha", "opacity", "confidence", "weight"]

alpha_name = None
for name in alpha_name_candidates:
    if name in data.dtype.names:
        alpha_name = name
        break

if alpha_name is None:
    raise ValueError("α(透明度/信頼度)に該当するプロパティが見つかりません")

print("使用αプロパティ:", alpha_name)
alpha = data[alpha_name]

# =========================
# STEP1: αフィルタ（最低限）
# =========================
mask = alpha > alpha_threshold
filtered = data[mask]

print("αフィルタ後:", len(filtered))

# =========================
# ボクセルダウンサンプリング関数
# =========================
def voxel_downsample(points, voxel_size):
    xyz = np.vstack([
        points['x'],
        points['y'],
        points['z']
    ]).T

    voxel_index = np.floor(xyz / voxel_size).astype(np.int32)
    _, unique_idx = np.unique(voxel_index, axis=0, return_index=True)

    return points[unique_idx]

# =========================
# STEP2: αで分岐（適応ボクセル）
# =========================
low_alpha_mask  = filtered[alpha_name] < alpha_split
high_alpha_mask = filtered[alpha_name] >= alpha_split

low_alpha_points  = filtered[low_alpha_mask]
high_alpha_points = filtered[high_alpha_mask]

print("低α点数:", len(low_alpha_points))
print("高α点数:", len(high_alpha_points))

low_down  = voxel_downsample(
    low_alpha_points,
    base_voxel_size * low_alpha_scale
)

high_down = voxel_downsample(
    high_alpha_points,
    base_voxel_size * high_alpha_scale
)

downsampled = np.concatenate([low_down, high_down])

print("適応ボクセル後:", len(downsampled))

# =========================
# STEP3: 最終 確率サンプリング
# =========================
if len(downsampled) > target_points:
    keep_ratio = target_points / len(downsampled)
    rand_mask = np.random.rand(len(downsampled)) < keep_ratio
    downsampled = downsampled[rand_mask]

print("最終点数:", len(downsampled))

# =========================
# 保存
# =========================
ply_out = PlyElement.describe(downsampled, 'vertex')
PlyData([ply_out], text=False).write(output_ply)

print("保存完了:", output_ply)
