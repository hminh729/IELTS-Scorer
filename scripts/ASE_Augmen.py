# code augmentation
import pandas as pd
import numpy as np
import nlpaug.augmenter.word as naw
import torch
import os

# 1. Cấu hình đường dẫn (Lưu ý: Chỉnh sửa phù hợp với môi trường Colab của bạn)
input_path = "../data/raw/ielts_writing_dataset1.csv"
output_path = "../data/raw/ielts_writing_dataset2.csv" # Mặc định lưu cục bộ để đồng bộ sau

def resample_and_augment(input_file, output_file):
    if not os.path.exists(input_file):
        print(f"❌ Không tìm thấy file đầu vào: {input_file}")
        return

    df = pd.read_csv(input_file)
    df = df.dropna(subset=['Essay', 'Question', 'Overall']).reset_index(drop=True)

    print("--- Thống kê gốc ---")
    counts = df['Overall'].value_counts().sort_index()
    print(counts)

    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    
    # Sử dụng nhiều cặp ngôn ngữ để tăng tính đa dạng cho các lớp cực hiếm
    aug_de = naw.BackTranslationAug(from_model_name='facebook/wmt19-en-de', to_model_name='facebook/wmt19-de-en', device=device)
    aug_fr = naw.BackTranslationAug(from_model_name='facebook/wmt19-en-fr', to_model_name='facebook/wmt19-fr-en', device=device)

    final_dfs = [df]

    for cls, count in counts.items():
        df_class = df[df['Overall'] == cls].copy()

        # Xác định mục tiêu dựa trên độ hiếm
        if count < 10:
            target = 150
            over_multiplier = 5 
        elif count < 50:
            target = 200
            over_multiplier = 2
        elif count < 150:
            target = 250
            over_multiplier = 1
        else:
            continue

        # 1. Oversampling (Nhân bản vật lý)
        if over_multiplier > 1:
            for _ in range(over_multiplier - 1):
                final_dfs.append(df_class)
            current_count = count * over_multiplier
        else:
            current_count = count

        # 2. Augmentation (Dùng Back-translation tạo biến thể)
        needed_aug = target - current_count
        if needed_aug > 0:
            print(f"Lớp {cls}: Hiện tại {current_count}, cần augment thêm {needed_aug}...")
            
            # Chia làm 2 nhóm ngôn ngữ để dữ liệu không bị lặp lại cấu trúc
            to_augment = df_class.sample(n=needed_aug, replace=True)
            
            augmented_essays = []
            for i, essay in enumerate(to_augment['Essay']):
                try:
                    # Luân phiên giữa các ngôn ngữ
                    aug_model = aug_de if i % 2 == 0 else aug_fr
                    aug_text = aug_model.augment(essay)
                    augmented_essays.append(aug_text[0])
                except Exception as e:
                    augmented_essays.append(essay)

            df_aug = to_augment.copy()
            df_aug['Essay'] = augmented_essays
            final_dfs.append(df_aug)

    # Gộp và xáo trộn
    df_final = pd.concat(final_dfs).sample(frac=1, random_state=42).reset_index(drop=True)

    print("\n--- Thống kê sau khi Augmentation ---")
    final_counts = df_final['Overall'].value_counts().sort_index()
    print(final_counts)

    # Đảm bảo thư mục tồn tại
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    df_final.to_csv(output_file, index=False)
    print(f"\n✅ Đã lưu dữ liệu tại: {output_file}")

if __name__ == "__main__":
    resample_and_augment(input_path, output_path)