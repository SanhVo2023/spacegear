# Hướng dẫn thiết lập Hồ sơ Doanh nghiệp trên Google cho spacegear

> Cập nhật ngày 23/10/2026. Các quy định và quy trình trong tài liệu này đã được đối chiếu với trang trợ giúp chính thức của Google vào ngày đó (xem mục 10). Giao diện của Google thay đổi khá thường xuyên, nên tên nút có thể khác đôi chút. Tên tiếng Anh của nút được ghi trong ngoặc để bạn dễ tìm.

Hồ sơ Doanh nghiệp trên Google (Google Business Profile, trong tài liệu này gọi tắt là "Hồ sơ") là khung thông tin hiện ra trên Google Tìm kiếm và Google Maps khi có người tìm spacegear. Hồ sơ hoàn toàn miễn phí. Tuy vậy, Google chỉ cấp Hồ sơ cho doanh nghiệp có gặp khách trực tiếp và xử lý rất nghiêm những hồ sơ khai sai. Vì thế, tài liệu đi theo đúng thứ tự cần làm: chuẩn bị, chọn loại hồ sơ cho đúng sự thật, tạo hồ sơ, xác minh, hoàn thiện, rồi duy trì hằng tháng.

## Tóm tắt: 5 việc bạn cần tự quyết định hoặc tự làm

1. **Chọn loại hồ sơ cho đúng (mục 2).** Câu hỏi then chốt là khách có đến Số 11, đường B4 trong giờ làm việc hay không. Nếu không, Hồ sơ phải ở dạng "phục vụ theo khu vực" và ẩn địa chỉ. Nếu spacegear hoàn toàn không gặp khách trực tiếp, theo quy định hiện hành thì chưa nên tạo Hồ sơ.
2. **Dùng admin@spacegear.tech làm chủ sở hữu chính, sau đó thêm một chủ sở hữu dự phòng** (mục 1.1 và 7.4).
3. **Chuẩn bị giấy tờ có tên "spacegear" và đúng địa chỉ** (giấy đăng ký kinh doanh, hoá đơn, hợp đồng thuê…). Bạn cần chúng khi quay video xác minh và khi phải kháng nghị lúc Hồ sơ bị khoá (mục 4 và 8).
4. **Chọn danh mục chính** (mục 5.1) và **quyết định có công bố giờ làm việc hay chỉ làm việc theo lịch hẹn** (mục 5.4).
5. **Dùng một bộ tên, địa chỉ, số điện thoại (gọi tắt là NAP) duy nhất ở mọi nơi**: website, Hồ sơ, Bing, Apple, mạng xã hội, chữ ký email (mục 1.4 và 6).

---

## 1. Trước khi bắt đầu

### 1.1 Dùng tài khoản Google nào

- **Nên dùng admin@spacegear.tech** (tài khoản Google Workspace). Tài khoản này mang tên miền của website, nên Hồ sơ gắn với doanh nghiệp chứ không phụ thuộc vào Gmail của một cá nhân. Chính Google cũng khuyên tạo tài khoản bằng email theo tên miền doanh nghiệp.
- Nếu đăng nhập business.google.com bằng tài khoản Workspace mà bị chặn, quản trị viên Workspace cần vào Admin console → Apps → Additional Google services → Google Business Profile Manager để bật dịch vụ này cho tài khoản.
- Hãy bật xác minh 2 bước cho tài khoản này. Ai giữ tài khoản này là người giữ Hồ sơ.
- Mỗi người cùng quản lý phải dùng tài khoản Google riêng. Google yêu cầu như vậy, và bạn cũng không cần chia sẻ mật khẩu cho ai.

### 1.2 Kiểm tra xem spacegear đã có hồ sơ nào chưa

Hãy mở Google Maps và lần lượt tìm "spacegear", số 0386 749 799 và địa chỉ. Nếu đã có một hồ sơ (do ai đó thêm vào, hoặc do Google tự tạo), bạn hãy yêu cầu quyền sở hữu hồ sơ đó (Claim this business hoặc Request ownership) thay vì tạo hồ sơ mới. Google chỉ cho phép một hồ sơ cho mỗi doanh nghiệp tại mỗi địa điểm, và hồ sơ trùng lặp có thể khiến tài khoản bị khoá.

### 1.3 Nên xác minh website trong Google Search Console trước

Google cho biết có trường hợp Hồ sơ được xác minh ngay lập tức khi website đã được xác minh trong Search Console. Điều này không được bảo đảm, nhưng website cũng cần Search Console nên đây là việc đáng làm trước:

1. Đăng nhập search.google.com/search-console bằng **cùng tài khoản admin@spacegear.tech**.
2. Thêm thuộc tính kiểu Tên miền (Domain) cho `spacegear.tech`.
3. Thêm bản ghi TXT mà Google đưa ra vào DNS của spacegear.tech trên Cloudflare. Người giữ tài khoản Cloudflare làm bước này.
4. Sau khi xác minh xong, gửi sơ đồ trang `https://spacegear.tech/sitemap.xml`.

### 1.4 Bộ thông tin chuẩn (NAP) để chép nguyên văn

| Mục | Giá trị dùng ở mọi nơi |
|---|---|
| Tên | `spacegear` (viết thường, đúng như logo) |
| Địa chỉ tiếng Việt | Số 11, đường B4, Khu đô thị Sala, phường An Khánh, TP. Hồ Chí Minh, Việt Nam |
| Địa chỉ tiếng Anh | 11 B4 Street, Sala Urban Area, An Khanh Ward, Ho Chi Minh City, Vietnam |
| Điện thoại | 0386 749 799 (gọi từ nước ngoài: +84 386 749 799) |
| Email | admin@spacegear.tech |
| Website | https://spacegear.tech (tiếng Anh), https://spacegear.tech/vi/ (tiếng Việt, sắp ra mắt) |
| Màu thương hiệu | #fa6e43 (Flame) trên nền #161719 (Night) |

Về tên: hãy nhập đúng `spacegear`. Không thêm ".tech", "AI", "Tư vấn chuyển đổi số", "TP.HCM" hay bất kỳ từ khoá nào vào tên. Google cấm thêm khẩu hiệu, mô tả dịch vụ, địa danh hay số điện thoại vào tên, và cảnh báo rằng thêm thông tin thừa vào tên có thể khiến Hồ sơ bị tạm ngưng. Nếu sau này spacegear dùng tên pháp lý kèm "Công ty TNHH" hay tương tự trên biển hiệu, hoá đơn và giấy tờ giao dịch với khách, khi đó mới cân nhắc đổi theo.

### 1.5 Những thứ cần có sẵn trong tay

- Điện thoại số 0386 749 799 để nhận cuộc gọi hoặc tin nhắn chứa mã xác minh. Lưu ý: tổng đài trả lời tự động không nhận được mã.
- Một điện thoại thông minh đã cài Google Maps, để quay video xác minh ngay tại địa chỉ.
- Giấy tờ chứng minh doanh nghiệp hoạt động tại địa chỉ, có tên khớp với Hồ sơ: giấy chứng nhận đăng ký doanh nghiệp, hoá đơn điện nước hoặc internet, hợp đồng thuê, hoá đơn đã xuất cho khách (che thông tin của khách khi quay).
- Logo: `public/icon-512.png` (biểu tượng màu Flame trên nền Night, 512 × 512 px, nền đặc) dùng được ngay. Nếu muốn nét hơn, nhờ người phụ trách kỹ thuật xuất bản 1024 × 1024 px từ `docs/brand/svg/spacegear-symbol-flame.svg` trên nền #161719. Không nên dùng các tệp PNG nền trong suốt trong `docs/brand/png/`, vì không biết trước Google sẽ đặt chúng lên nền màu gì. Bản nền đặc trông giống nhau ở mọi nơi và đúng phiên bản chính của thương hiệu (màu cam trên nền Night).
- Từ 3 đến 10 ảnh chụp thật (xem mục 5.8).
- Mô tả doanh nghiệp và danh sách dịch vụ (mục 5.2 và 5.3).
- Website đã hiển thị đúng NAP. Nhánh `feat/bilingual` đưa địa chỉ và số điện thoại lên trang Liên hệ, chân trang và dữ liệu có cấu trúc (JSON-LD). Tốt nhất là phần này lên website trước hoặc cùng lúc với Hồ sơ.

---

## 2. Quyết định quan trọng: đón khách tại địa chỉ hay phục vụ theo khu vực

### 2.1 Quy định của Google

- **Điều kiện chung:** doanh nghiệp phải gặp khách trực tiếp trong giờ làm việc đã công bố. Google ghi rõ rằng doanh nghiệp chỉ hoạt động trực tuyến không đủ điều kiện có Hồ sơ.
- **Có địa điểm đón khách (storefront):** khách đến địa chỉ của bạn trong giờ làm việc, tại đó có biển hiệu cố định mang tên doanh nghiệp và luôn có người của bạn trực. Địa chỉ được hiện công khai.
- **Phục vụ theo khu vực (service-area business):** bạn đến gặp khách hoặc phục vụ khách tại nơi của họ, và không tiếp khách tại địa chỉ của mình. Google yêu cầu loại này **phải ẩn địa chỉ**. Hồ sơ chỉ hiện khu vực phục vụ.
- **Kết hợp (hybrid):** vừa đón khách tại địa chỉ có biển và có người trực, vừa đi gặp khách. Địa chỉ được hiện, kèm theo khu vực phục vụ.
- **Không đủ điều kiện:** văn phòng ảo (chỉ thuê địa chỉ nhận thư), hộp thư, chỗ ngồi ở không gian làm việc chung (coworking) mà không có biển hiệu, không có người trực và không tiếp khách trong giờ làm việc.

### 2.2 Tự kiểm tra bằng ba câu hỏi

| Câu hỏi | Nếu "có" | Nếu "không" |
|---|---|---|
| 1. spacegear có gặp khách trực tiếp không? (tại văn phòng của khách, tại nơi hẹn, hoặc tại địa chỉ của mình) | Sang câu 2 | Chỉ làm việc qua mạng thì chưa đủ điều kiện. Đừng tạo Hồ sơ; hãy tập trung vào website và Search Console. |
| 2. Khách có đến Số 11, đường B4 trong giờ làm việc đã công bố không, và lúc đó luôn có người của spacegear ở đó? | Sang câu 3 | Chọn **phục vụ theo khu vực** và ẩn địa chỉ. |
| 3. Ở địa chỉ có biển hiệu cố định ghi "spacegear", nhìn thấy được từ bên ngoài (không phải tờ giấy dán tạm)? | Chọn **có địa điểm đón khách**, hoặc **kết hợp** nếu bạn cũng đi gặp khách | Chọn **phục vụ theo khu vực**. Khi nào đã lắp biển và có người trực thì chuyển sang hiện địa chỉ. |

### 2.3 Gợi ý cho spacegear

Với một công ty tư vấn, phần lớn buổi làm việc thường diễn ra tại văn phòng của khách hoặc qua họp trực tuyến. Nếu Số 11, đường B4 là nơi làm việc nhưng không thường xuyên đón khách, lựa chọn trung thực là **phục vụ theo khu vực**: ẩn địa chỉ và đặt khu vực phục vụ là Thành phố Hồ Chí Minh. Khi nào spacegear có văn phòng gắn biển và có người trực trong giờ làm việc, bạn có thể bật lại phần hiện địa chỉ. Khi đó Google có thể yêu cầu xác minh lại.

Ẩn địa chỉ không có nghĩa là bỏ địa chỉ. Bạn vẫn nhập đầy đủ địa chỉ để Google xác minh, chỉ tắt tuỳ chọn hiển thị công khai (Show business address to customers). Website vẫn có thể ghi địa chỉ liên hệ. Nếu không đón khách vãng lai, nên ghi thêm trên website rằng spacegear gặp khách theo lịch hẹn, để khách không đến nhầm.

### 2.4 Quy tắc về khu vực phục vụ

- Tối đa 20 khu vực, chọn theo tỉnh/thành phố, phường/xã hoặc mã bưu chính. Không được khai theo bán kính quanh trụ sở.
- Ranh giới khu vực không nên xa quá khoảng 2 giờ lái xe tính từ nơi đặt trụ sở.
- Với spacegear: chọn **Thành phố Hồ Chí Minh**. Từ ngày 1/7/2025, thành phố này đã bao gồm cả địa bàn Bình Dương và Bà Rịa – Vũng Tàu cũ. Chỉ thêm tỉnh khác (ví dụ Đồng Nai) nếu bạn thật sự đến gặp khách ở đó.
- Nếu danh sách gợi ý vẫn hiện tên cũ như "Quận 2", "TP. Thủ Đức" hay "Bình Dương", đừng chọn chúng. Chọn "Thành phố Hồ Chí Minh" là đủ, vì tên này không thay đổi.

---

## 3. Tạo hồ sơ từng bước

### 3.1 Trình tự trên máy tính

1. Đăng nhập bằng admin@spacegear.tech, rồi mở **business.google.com/create**.
2. **Tên doanh nghiệp (Business name):** gõ `spacegear`. Nếu Google gợi ý một hồ sơ có sẵn trùng tên, hãy xem kỹ. Nếu đúng là spacegear thì yêu cầu quyền sở hữu thay vì tạo mới.
3. **Danh mục (Business category):** gõ và chọn danh mục chính mà bạn đã quyết định ở mục 5.1, ví dụ `Computer consultant`. Bấm **Next**.
4. **Câu hỏi về địa điểm khách có thể đến** (Do you want to add a location customers can visit?):
   - Chọn **Yes** chỉ khi spacegear có địa điểm đón khách, có biển và có người trực trong giờ làm việc (mục 2).
   - Chọn **No** nếu spacegear phục vụ theo khu vực.
5. **Địa chỉ:** nếu chọn Yes, nhập địa chỉ theo mục 3.2 rồi kéo ghim cho đúng vị trí. Nếu chọn No, Google vẫn có thể hỏi địa chỉ ở bước xác minh. Bạn cứ nhập đầy đủ theo mục 3.2, vì địa chỉ đó không hiện công khai.
6. **Khu vực phục vụ:** chọn `Thành phố Hồ Chí Minh` (mục 2.4). Nếu bỏ qua bước này, Google sẽ tự chọn một khu vực mặc định và bạn sửa lại sau.
7. **Thông tin liên hệ:**
   - Số điện thoại: chọn mã quốc gia Việt Nam (+84) và nhập `386 749 799`. Google thường tự định dạng lại số này.
   - Website: `https://spacegear.tech/?utm_source=google&utm_medium=organic&utm_campaign=gbp` (giải thích ở mục 6.3).
8. Bấm **Next**, rồi **Finish**.
9. Google mở bước xác minh. Bấm **Verify now** để làm ngay, hoặc **Verify later** nếu chưa có mặt tại địa chỉ hay chưa chuẩn bị giấy tờ. Xem mục 4 trước khi bấm.

Trong lúc tạo, Google có thể hỏi thêm giờ làm việc, mô tả và ảnh. Bạn có thể bỏ qua và điền sau theo mục 5. Ảnh chỉ hiển thị công khai sau khi Hồ sơ đã được xác minh.

### 3.2 Nhập địa chỉ sau đợt sắp xếp đơn vị hành chính năm 2025

**Bối cảnh.** Từ ngày 1/7/2025, chính quyền địa phương ở Việt Nam chỉ còn hai cấp là tỉnh/thành phố và xã/phường; cấp quận/huyện không còn. Theo Nghị quyết 1685/NQ-UBTVQH15, phường An Khánh mới được lập từ các phường An Khánh, An Lợi Đông, Thảo Điền, Thủ Thiêm và một phần phường An Phú của TP. Thủ Đức cũ. Khu đô thị Sala nằm trong phường mới này.

**Dữ liệu của Google chưa theo kịp.** Từ khoảng tháng 3/2026, Google Maps đã bắt đầu hiển thị ranh giới phường, xã mới, nhưng một số địa chỉ vẫn hiện theo cấu trúc cũ có cấp quận. Vào ngày kiểm tra, dữ liệu biểu mẫu địa chỉ Việt Nam mà Google công bố (Chrome và nhiều biểu mẫu khác dùng nguồn này) vẫn liệt kê 63 tỉnh cũ. Theo dữ liệu đó, biểu mẫu chỉ bắt buộc hai ô là địa chỉ đường phố và tỉnh/thành phố; ô thành phố/quận và ô mã bưu chính là không bắt buộc.

**Cách điền khi biểu mẫu vẫn còn ô quận/huyện hoặc gợi ý tên cũ:**

| Ô trên biểu mẫu | Nội dung nhập |
|---|---|
| Quốc gia/khu vực (Country/Region) | Việt Nam |
| Địa chỉ đường phố (Street address) | `Số 11, đường B4` |
| Dòng địa chỉ 2 (Address line 2), nếu có | `Khu đô thị Sala, phường An Khánh` |
| Quận/huyện hoặc Thành phố (District, City), nếu có | Để trống nếu ô này không bắt buộc. Nếu buộc phải điền, nhập `Phường An Khánh` vào ô này và bỏ cụm "phường An Khánh" khỏi dòng 2. |
| Tỉnh/thành phố (Province) | `Thành phố Hồ Chí Minh` |
| Mã bưu chính (Postal code) | Để trống, vì website cũng chưa dùng mã nào. Nếu biểu mẫu bắt buộc, hãy tra mã hiện hành trên mabuuchinh.vn (cổng tra cứu mã bưu chính quốc gia), rồi dùng đúng mã đó ở mọi nơi, kể cả website. |

**Những điều cần tránh:**

- Không chọn và không gõ tên cũ như "Quận 2", "TP. Thủ Đức", "phường An Lợi Đông" hay "phường Thủ Thiêm", kể cả khi Google tự gợi ý. Nếu gợi ý tự động chứa tên cũ, hãy bỏ qua gợi ý và tự gõ từng ô.
- Không thêm mô tả kiểu "đối diện công viên" hay từ khoá vào các dòng địa chỉ.
- Sau khi nhập, bấm **Adjust** và kéo ghim đến đúng Số 11, đường B4, rồi bấm **Done** và **Save**.

**Theo dõi về sau.** Google đôi khi tự cập nhật thông tin hồ sơ dựa trên nguồn bên ngoài. Những thay đổi này hiện màu xanh trong trình chỉnh sửa (Google updates). Nếu thấy Google đổi địa chỉ về dạng cũ, hãy sửa lại cho đúng chuỗi chuẩn.

**Một địa chỉ, hai cách viết.** Hồ sơ chỉ nhận một địa chỉ. Hãy nhập bản tiếng Việt, vì đó là cách ghi địa chỉ chính thức tại Việt Nam. Bản tiếng Anh dùng cho trang tiếng Anh của website và cho các danh bạ quốc tế. Danh sách chọn tỉnh ghi "Thành phố Hồ Chí Minh", còn website viết "TP. Hồ Chí Minh". Đây chỉ là cách viết tắt của cùng một tên, không phải sai lệch. Ở những nơi được gõ tự do, hãy chép nguyên văn chuỗi chuẩn ở mục 1.4.

---

## 4. Xác minh

### 4.1 Cách Google chọn phương thức

Google tự quyết định bạn được dùng phương thức xác minh nào, và bạn không đổi được. Lựa chọn phụ thuộc vào loại hình kinh doanh, khu vực, giờ làm việc và thông tin công khai. Một số doanh nghiệp phải xác minh bằng nhiều phương thức. Các phương thức hiện có:

| Phương thức | Điều cần biết |
|---|---|
| **Quay video (Business video)** | Google khuyên dùng nếu Hồ sơ đủ điều kiện. Xem mục 4.2. |
| **Gọi video trực tiếp (Live video call)** | Chỉ có trong giờ làm việc của địa điểm và không phải doanh nghiệp nào cũng được dùng. Bạn phải có mặt tại địa điểm để cho nhân viên Google xem vị trí và bằng chứng sở hữu. |
| **Điện thoại hoặc tin nhắn SMS** | Nghe máy hoặc mở tin nhắn để lấy mã, rồi nhập vào Hồ sơ. |
| **Email** | Phải truy cập được hộp thư hiện trên màn hình xác minh. |
| **Bưu thiếp (Postcard)** | Không phải doanh nghiệp nào cũng được dùng. Mã thường đến trong vòng 14 ngày và hết hạn sau 30 ngày. Trong lúc chờ, không sửa tên, địa chỉ, danh mục và không yêu cầu mã mới, vì mã cũ sẽ mất hiệu lực. |
| **Xác minh tức thì** | Có thể xảy ra khi website đã được xác minh trong Search Console (mục 1.3). |

Chúng tôi chưa tìm được nguồn chính thức nào cho biết phương thức nào đang được cấp cho doanh nghiệp tại Việt Nam. Bạn chỉ biết chắc khi bấm **Get verified** trên Hồ sơ.

Google xét duyệt trong tối đa 5 ngày làm việc, đôi khi lâu hơn. Google không bao giờ hỏi mã xác minh của bạn. Đừng đưa mã cho bất kỳ ai, kể cả người cùng quản lý Hồ sơ.

### 4.2 Quay video xác minh

**Yêu cầu chung:**

- Quay trực tiếp bằng điện thoại, trong ứng dụng, qua Hồ sơ. Không được dùng video quay sẵn, không quay ngoại tuyến rồi tải lên sau.
- Một đoạn liền mạch, không cắt ghép, dài **ít nhất 30 giây**.
- Không quay số tài khoản ngân hàng, mã số thuế, số giấy tờ tuỳ thân, thông tin riêng tư, và không quay mặt người khác.

**Cách bắt đầu:** trên điện thoại, mở Hồ sơ → **Get verified** → **Business video** → **Next**. Đọc yêu cầu, cho phép truy cập vị trí, máy ảnh và micro → **Next** → **Start recording**. Quay xong, xem lại; nếu chưa ổn thì bấm **Try again**, nếu ổn thì bấm **Upload video**.

**Kịch bản gợi ý nếu spacegear phục vụ theo khu vực** (khoảng 45 đến 60 giây):

1. **Vị trí** (khoảng 15 giây): bắt đầu ở ngoài đường, quay biển tên đường B4, số nhà 11 và một vài điểm dễ nhận ra của khu đô thị Sala, để Google đối chiếu với bản đồ.
2. **Doanh nghiệp có thật** (khoảng 15 giây): đi vào nơi làm việc, quay máy tính đang mở website spacegear.tech hoặc tài liệu nội bộ (không mở dữ liệu của khách), danh thiếp hoặc vật dụng có logo spacegear.
3. **Bằng chứng quản lý** (khoảng 15 giây): mở khoá cửa nơi làm việc bằng chìa khoá của bạn, rồi quay một giấy tờ có tên khớp với Hồ sơ và đúng địa chỉ, như giấy đăng ký kinh doanh, hoá đơn điện nước hoặc hoá đơn đã xuất. Che mã số thuế và các con số nhạy cảm bằng tay hoặc tờ giấy.

**Nếu spacegear có địa điểm đón khách:** video phải cho thấy biển hiệu cố định ghi "spacegear" khớp với tên trên Hồ sơ, cảnh xung quanh khớp với bản đồ, và một khu vực chỉ người của doanh nghiệp được vào. "Không thấy tên doanh nghiệp trên biển hiệu" là một trong những lý do từ chối mà Google nêu làm ví dụ.

**Sau khi gửi video:** chờ tối đa 5 ngày làm việc. Nếu bị từ chối, Hồ sơ hiện nút **Review issues**. Hãy đọc từng điểm còn thiếu, rồi quay video mới có đủ mọi nội dung của video cũ cộng với phần còn thiếu. Bạn có thể xoá video đã gửi trong Business Profile settings → Advanced settings → Video uploads.

### 4.3 Khi không xác minh được

- Nếu nút **Get verified** hiện lại, nghĩa là Google chưa xác minh xong. Hãy làm lại hoặc thử phương thức khác nếu có.
- Nếu Google yêu cầu thêm thông tin, thường là do bạn vừa sửa thông tin. Hãy bấm **Get verified** và làm theo hướng dẫn.
- Nếu không còn cách nào, hãy liên hệ bộ phận hỗ trợ tại support.google.com/business/gethelp.
- Đừng tạo hồ sơ thứ hai để "thử lại".

---

## 5. Hoàn thiện hồ sơ

Mọi chỉnh sửa đều làm trong **Edit profile** (trên Google Tìm kiếm hoặc Google Maps, khi đang đăng nhập admin@spacegear.tech). Google xem xét mỗi thay đổi trước khi đăng. Thường mất khoảng 10 phút, nhưng có khi đến 30 ngày.

### 5.1 Danh mục

Google khuyên dùng ít danh mục nhất có thể, chọn danh mục cụ thể nhất, và chọn theo câu "doanh nghiệp này **là** một…" chứ không phải "doanh nghiệp này **có**…". Theo Google, danh mục ảnh hưởng đến thứ hạng tìm kiếm địa phương. Đổi danh mục có thể khiến Google yêu cầu xác minh lại, nên hãy chọn kỹ ngay từ đầu.

Các danh mục dưới đây có trong danh sách danh mục của Google (đối chiếu với một bản tổng hợp cập nhật tháng 5/2026, vì trang trợ giúp của Google không đăng danh sách đầy đủ) và khớp với dịch vụ trên website:

| Danh mục (tên tiếng Anh) | Vì sao phù hợp | Đề xuất |
|---|---|---|
| `Computer consultant` | Gần nhất với tư vấn công nghệ: AI, tự động hoá, tích hợp hệ thống | **Danh mục chính** (gợi ý) |
| `Business management consultant` | Khớp với chiến lược chuyển đổi số: lộ trình, ưu tiên, quy trình | Danh mục phụ. Chọn làm danh mục chính nếu bạn muốn spacegear được nhìn nhận trước hết là đơn vị tư vấn chiến lược. |
| `Software company` | Khớp với phát triển sản phẩm và nền tảng số, và với AI ứng dụng | Danh mục phụ |

Không nên chọn:

- `Consultant`: quá chung chung. Google tự thêm danh mục rộng hơn nên không cần.
- `Internet marketing service`, `Marketing agency`, `Website designer`: website không giới thiệu các dịch vụ này.
- `Automation company`: danh mục này thiên về tự động hoá công nghiệp.
- Trong bản tổng hợp chúng tôi đối chiếu, không có danh mục riêng cho "trí tuệ nhân tạo" hay "chuyển đổi số". Bạn đừng chọn một danh mục lệch nghĩa chỉ vì nó chứa từ khoá.

Nếu giao diện đang là tiếng Việt, tên danh mục sẽ được dịch và có thể nghe hơi lạ. Cách chắc chắn nhất là tạm chuyển ngôn ngữ tài khoản Google sang English khi chọn danh mục, rồi chuyển lại sau. Cách khác là gõ từ khoá như "tư vấn", "phần mềm", "máy tính" và chọn mục có nghĩa tương ứng.

### 5.2 Mô tả doanh nghiệp

**Quy định:** tối đa 750 ký tự. Không chứa đường link, mã HTML, giá cả, khuyến mãi hay ký tự trang trí. Nội dung chỉ nói về doanh nghiệp: làm gì, cho ai, khác biệt ở đâu. Google có nút gợi ý mô tả bằng AI (Suggest description), nhưng nếu dùng thì bạn phải tự kiểm tra lại từng chữ.

**Chọn ngôn ngữ.** Hồ sơ chỉ có một ô mô tả. Nếu khách hàng chủ yếu tìm spacegear từ Việt Nam, hãy dùng bản tiếng Việt. Bản tiếng Anh dành cho trường hợp bạn chủ yếu nhắm đến khách nước ngoài. Cả hai bản dưới đây chỉ dùng những nội dung đã có trên website; không thêm số năm, số khách hàng hay kết quả nào.

**Bản tiếng Việt (638 ký tự):**

> spacegear tư vấn chuyển đổi số và AI, từ chiến lược đến hệ thống vận hành thực tế. Chúng tôi giúp doanh nghiệp hiện đại hóa cách vận hành, kết nối dữ liệu và đưa AI vào công việc một cách thiết thực. Năm dịch vụ chính gồm: chiến lược chuyển đổi số; chiến lược AI và xây dựng năng lực; AI ứng dụng và học sâu; tự động hóa và tích hợp hệ thống; phát triển sản phẩm và nền tảng số. Chúng tôi bắt đầu từ cách công việc đang thực sự diễn ra, so sánh AI với những cách làm đơn giản hơn, rồi xây dựng và đánh giá giải pháp, có con người kiểm tra ở những bước cần thiết. Bạn có thể bắt đầu bằng một bài toán cụ thể mà doanh nghiệp muốn cải thiện.

**Bản tiếng Anh (568 ký tự):**

> spacegear is a digital transformation and AI consultancy, from strategy to working systems. We help organizations modernize operations, connect data and put AI to work. Our five core services are digital transformation strategy, AI strategy and enablement, applied AI and deep learning, automation and systems integration, and digital product and platform delivery. We start with how work actually happens, compare AI with simpler alternatives, then build and evaluate solutions with human review where it matters. You can start with one challenge you want to improve.

### 5.3 Dịch vụ

Vào **Edit services** → **Add more services** → **Add custom service** và thêm năm dịch vụ dưới đây. Tên và mô tả lấy từ nội dung dịch vụ trên website (tên tiếng Việt lấy theo bản dịch đang soạn cho `/vi/`; nếu bản dịch ấy được sửa, hãy sửa Hồ sơ theo). Không ghi giá, không ghi số điện thoại vào tên dịch vụ. Mỗi mô tả chỉ nên dài một đến hai câu.

| Dịch vụ (tiếng Việt) | Mô tả ngắn (tiếng Việt) | Tên tiếng Anh |
|---|---|---|
| Chiến lược chuyển đổi số | Tìm ra điểm nghẽn, xác định ưu tiên và vạch một lộ trình thiết thực từ cách làm việc hiện nay đến bước tiếp theo. | Digital Transformation Strategy |
| Chiến lược AI & xây dựng năng lực | Đi từ sự quan tâm đến AI tới một quyết định có cơ sở: AI có thể giúp ở đâu, cần những gì và nên bắt đầu thế nào. | AI Strategy & Enablement |
| AI ứng dụng & học sâu | Biến dữ liệu và thông tin phi cấu trúc thành phần mềm hữu ích, có sẵn khâu đánh giá và sự giám sát của con người. | Applied AI & Deep Learning |
| Tự động hóa & tích hợp hệ thống | Kết nối các công cụ đang dùng và giảm việc thủ công lặp lại, trong khi các ngoại lệ và quyền kiểm soát vẫn luôn rõ ràng. | Automation & Systems Integration |
| Phát triển sản phẩm & nền tảng số | Đưa ý tưởng qua các bước khảo sát, thiết kế và phát triển để thành phần mềm mà mọi người dùng được và cải tiến được. | Digital Product & Platform Delivery |

### 5.4 Giờ làm việc

Quy định của Google có hai ý cần nắm:

- Giờ làm việc phải là giờ bạn thật sự phục vụ khách.
- Doanh nghiệp **chỉ làm việc theo lịch hẹn** thuộc nhóm **không nên khai giờ làm việc**.

Vì vậy, hãy chọn một trong hai cách:

- **Cách A, chỉ làm việc theo lịch hẹn:** để trống giờ làm việc. Đây là cách trung thực nếu bạn chỉ gặp khách khi đã hẹn trước.
- **Cách B, có giờ cố định:** nếu trong những khung giờ nhất định bạn luôn nghe máy, trả lời khách và có thể đến gặp khách (ví dụ thứ Hai đến thứ Sáu, 8:30 đến 17:30), hãy khai đúng khung giờ đó.

Nếu chọn cách B, hãy dùng giờ đặc biệt (Special hours) cho Tết và các ngày lễ. Đừng khai giờ chỉ để Hồ sơ trông "đầy đủ" hơn. Lưu ý thêm: gọi video trực tiếp (Live video call) chỉ diễn ra trong giờ làm việc của địa điểm. Nếu không khai giờ, có thể bạn sẽ không được dùng cách này, nhưng vẫn còn những cách xác minh khác.

### 5.5 Thuộc tính

Vào **Edit profile** → **More** và chỉ chọn những thuộc tính đúng với sự thật. Danh sách thuộc tính thay đổi theo danh mục và quốc gia.

Google có thuộc tính tự khai **Doanh nghiệp nhỏ (Small business)**, và đôi khi tự gắn thuộc tính này dựa trên thông tin sẵn có. spacegear đã quyết định không công khai quy mô công ty trên website, nên đừng bật thuộc tính này trên Hồ sơ. Nếu Google tự gắn, hãy tắt đi.

### 5.6 Liên kết

| Ô | Giá trị |
|---|---|
| Website | `https://spacegear.tech/?utm_source=google&utm_medium=organic&utm_campaign=gbp` |
| Liên kết đặt lịch hẹn (Booking, Appointments), nếu ô này xuất hiện | `https://spacegear.tech/contact/?utm_source=google&utm_medium=organic&utm_campaign=gbp&utm_content=appointment` |
| Mạng xã hội | Chỉ thêm trang có thật và do spacegear quản lý (LinkedIn, Facebook…). Website hiện chưa liệt kê trang mạng xã hội nào. |

Về liên kết đặt lịch hẹn:

- Ô này chỉ xuất hiện với một số danh mục và quốc gia, và chỉ thêm được sau khi Hồ sơ đã xác minh.
- Google yêu cầu liên kết phải cho phép khách thực hiện đúng việc mà nút ghi. Trang `/contact/` cho khách gửi yêu cầu trao đổi về dự án, nên nhiều khả năng được chấp nhận. Dù vậy, Google vẫn có thể gỡ liên kết nếu cho rằng trang không cho đặt lịch. Nếu bị gỡ, chỉ cần giữ liên kết website là đủ.
- Trình thu thập dữ liệu của Google (Google-BusinessLinkVerification) phải mở được trang: trang trả mã 200, không bắt đăng nhập hay giải CAPTCHA chỉ để xem trang. Nếu sau này bật chế độ chặn bot trên Cloudflare, hãy kiểm tra để không chặn nhầm trình thu thập này.

### 5.7 Ngày bắt đầu hoạt động

Ô Opening date chỉ nhận tháng và năm. Đây là thông tin không bắt buộc. Chỉ điền nếu bạn chắc chắn về mốc này và sẵn sàng công khai nó.

### 5.8 Logo, ảnh bìa, ảnh và video

**Thông số Google yêu cầu:**

| Loại | Yêu cầu |
|---|---|
| Ảnh | JPG hoặc PNG, từ 10 KB đến 5 MB, khuyến nghị 720 × 720 px, tối thiểu 250 × 250 px. Ảnh rõ nét, đủ sáng, không chỉnh sửa nhiều, không lạm dụng bộ lọc màu. |
| Video | Dài tối đa 30 giây, tối đa 75 MB, độ phân giải từ 720p trở lên. |

**Gợi ý cho spacegear:**

- **Logo:** dùng `public/icon-512.png`, hoặc bản 1024 × 1024 px trên nền Night như mục 1.5. Logo được làm nổi bật khi Hồ sơ đủ các thông tin cơ bản.
- **Ảnh bìa:** nên là một ảnh chụp thật theo khổ ngang (nơi làm việc, một buổi làm việc). Google không bảo đảm ảnh bìa luôn hiện đầu tiên, và có thể thay bằng ảnh khác nếu ảnh bìa chất lượng thấp hoặc không đại diện tốt cho doanh nghiệp.
- **Ảnh khác:** góc làm việc (màn hình không có dữ liệu của khách), một buổi trao đổi hay hội thảo (đã xin phép người trong ảnh), mặt ngoài và biển hiệu nếu có địa điểm đón khách.
- Ảnh phải phản ánh đúng thực tế. Không dùng ảnh mua từ kho ảnh, không dùng các ảnh dựng 3D minh hoạ trên website làm "ảnh doanh nghiệp", không dùng ảnh do AI tạo.
- Phù hợp với chủ trương không công khai quy mô công ty: không cần ảnh "toàn bộ đội ngũ".
- Ảnh tải lên khi Hồ sơ chưa xác minh sẽ ở trạng thái Pending, và chỉ hiện công khai sau khi xác minh xong. Ảnh đã duyệt có thể mất 24 đến 48 giờ mới hiện.

### 5.9 Bài đăng đầu tiên

Sau khi xác minh, hãy đăng một bài cập nhật (Update) giới thiệu ngắn về spacegear và cách bắt đầu: khách mang đến một bài toán, spacegear cùng tìm hướng giải. Gắn nút dẫn về trang Liên hệ, dùng liên kết có UTM như ở mục 6.3. Chi tiết về bài đăng xem mục 7.1.

---

## 6. Giữ thông tin nhất quán với website và đo lường

### 6.1 NAP phải giống nhau ở mọi nơi

Google tổng hợp thông tin về doanh nghiệp từ Hồ sơ, website và nhiều nguồn khác, và đôi khi tự cập nhật Hồ sơ theo những nguồn đó. Thông tin lệch nhau vừa khiến khách bối rối, vừa có thể khiến Google tự sửa Hồ sơ theo một nguồn sai. Hãy dùng bộ NAP ở mục 1.4 cho:

- website: trang Liên hệ, chân trang, trang Quyền riêng tư và Điều khoản, JSON-LD;
- Hồ sơ Google, Bing Places, Apple Business;
- LinkedIn, Facebook, Zalo OA (nếu có), các danh bạ doanh nghiệp;
- chữ ký email, hoá đơn, hồ sơ năng lực, danh thiếp.

Mỗi khi đổi địa chỉ hay số điện thoại, hãy sửa tất cả những nơi trên trong cùng một tuần, bắt đầu từ website.

### 6.2 Quan hệ với JSON-LD trên website

Theo thiết kế của nhánh `feat/bilingual`, khối Organization trong JSON-LD sẽ có `address` (PostalAddress: `streetAddress`, `addressLocality` là "Ho Chi Minh City" hoặc "Thành phố Hồ Chí Minh", `addressCountry` là "VN", không có mã bưu chính) và `telephone` là `+84386749799`. Mấy điểm cần giữ khớp:

- **Tên:** JSON-LD hiện ghi `name` là "spacegear.tech", còn Hồ sơ dùng "spacegear". Nên đề nghị người phụ trách kỹ thuật đặt `name` là "spacegear" và `alternateName` là "spacegear.tech", để hai nơi gọi doanh nghiệp bằng cùng một tên.
- **Địa chỉ:** cùng chuỗi với Hồ sơ. Nếu sau này bạn điền mã bưu chính vào Hồ sơ, hãy thêm đúng mã đó vào JSON-LD.
- **Giờ làm việc:** nếu Hồ sơ không khai giờ (Cách A ở mục 5.4), JSON-LD cũng không nên có `openingHours`.
- **Kiểu dữ liệu:** với hình thức phục vụ theo khu vực, kiểu `Organization` hiện tại là phù hợp. Nếu sau này có địa điểm đón khách, có thể chuyển sang một kiểu con của `LocalBusiness`, như `ProfessionalService`, kèm giờ làm việc khớp với Hồ sơ.
- **Không chép đánh giá Google vào JSON-LD** (`Review`, `AggregateRating`). Website đã có quy định không dùng đánh giá tự đăng trong dữ liệu có cấu trúc.
- Khi Hồ sơ đã hoạt động, có thể thêm đường dẫn Google Maps của Hồ sơ vào `sameAs`. Việc này không bắt buộc.

JSON-LD không trực tiếp cập nhật Hồ sơ. Nó chỉ giúp Google hiểu rằng website và Hồ sơ nói về cùng một doanh nghiệp.

### 6.3 Đo lường

- **UTM:** liên kết website trên Hồ sơ gắn `?utm_source=google&utm_medium=organic&utm_campaign=gbp`, liên kết đặt lịch thêm `&utm_content=appointment`, và nút trong bài đăng thêm `&utm_content=post`. Nhờ vậy, công cụ phân tích tách được lượt truy cập từ Hồ sơ khỏi lượt tìm kiếm thường. Hãy giữ toàn bộ chữ thường, vì "GBP" và "gbp" sẽ bị tính thành hai nguồn khác nhau. Trang có UTM vẫn khai báo URL chuẩn (canonical) không có UTM, nên không tạo trang trùng lặp. Theo thiết kế, khi website tự chuyển khách ở Việt Nam sang `/vi/`, chuỗi UTM vẫn được giữ.
- **Số liệu trong Hồ sơ:** phần Hiệu suất (Performance) cho biết số lượt xem, lượt tìm kiếm, lượt gọi, lượt bấm vào website và lượt hỏi đường.
- **Search Console:** theo dõi các truy vấn đưa người dùng đến website (mục 1.3).
- **Google Analytics 4, nếu sau này website dùng:** từ tháng 6/2026, có thể liên kết Hồ sơ với GA4 trong Admin → Product links → Google Business Profile links. Chỉ số của Hồ sơ (lượt tương tác, cuộc gọi, lượt bấm website, chỉ đường…) sẽ hiện trong một nhóm báo cáo riêng. Người liên kết cần quyền Editor hoặc Administrator trên GA4 và quyền Owner hoặc Manager trên Hồ sơ. Hiện website chưa gắn GA4. Nếu dùng công cụ phân tích khác, hãy kiểm tra xem công cụ đó có đọc được tham số UTM không.
- **Yêu cầu liên hệ:** biểu mẫu Liên hệ hiện chưa ghi nhận khách đến từ đâu. Khi trả lời một yêu cầu mới, bạn có thể hỏi thêm một câu: "Anh/chị biết đến spacegear qua đâu?"

---

## 7. Vận hành hằng tháng

### 7.1 Bài đăng

- Có ba loại bài: Cập nhật (Update), Ưu đãi (Offer) và Sự kiện (Event). Với spacegear, chủ yếu dùng **Update**.
- Nhịp gợi ý là một đến hai bài mỗi tháng, về những việc có thật: bài viết mới trên website, giải thích ngắn một dịch vụ, cách spacegear bắt đầu một dự án, một hội thảo bạn tham gia hoặc tổ chức.
- Bài đăng quá 6 tháng sẽ được lưu trữ, trừ khi bạn đặt khoảng ngày cho bài. Bài phải được duyệt (Live) mới hiển thị.
- Không ghi số điện thoại hay email vào nội dung bài, vì Google có thể gỡ bài có thông tin liên hệ chưa xác minh. Hãy dùng nút gọi điện (Call now), nút này lấy số đã xác minh của Hồ sơ.
- Không đăng giá, không đăng ưu đãi kèm số liệu chưa kiểm chứng. Không dùng bài đăng để nêu kết quả, khách hàng hay con số mà website chưa công bố.

### 7.2 Đánh giá: xin đúng cách

- **Lấy đường link và mã QR:** trên máy tính, mở Hồ sơ → **Read Reviews** → **Get more reviews**, rồi sao chép link hoặc lưu ảnh mã QR. Mã QR chỉ tạo được trên máy tính.
- **Xin đánh giá từ mọi khách đã làm việc thật**, sau khi bàn giao hoặc kết thúc một giai đoạn. Không chỉ xin từ những khách bạn đoán sẽ khen.
- **Tuyệt đối không:**
  - tặng quà, giảm giá hay trả tiền để đổi lấy đánh giá, hoặc để khách sửa hay xoá đánh giá xấu;
  - xin đánh giá từ nhân viên, người thân, đối tác có quyền lợi liên quan, và không tự đánh giá doanh nghiệp mình;
  - đánh giá đối thủ;
  - ép khách viết ngay tại chỗ, đặt chỉ tiêu số lượng đánh giá, hay đề nghị khách viết theo nội dung cho sẵn;
  - lọc trước, chỉ gửi link cho khách hài lòng.
- Vi phạm có thể khiến Google xoá đánh giá, chặn Hồ sơ nhận đánh giá mới trong một thời gian, tạm ẩn các đánh giá hiện có, và hiện cảnh báo cho người xem rằng đánh giá giả đã bị gỡ.

**Mẫu tin nhắn xin đánh giá (tiếng Việt):**

> Chào anh/chị [Tên],
>
> Cảm ơn anh/chị đã làm việc cùng spacegear trong [tên dự án hoặc giai đoạn]. Nếu có vài phút, anh/chị có thể chia sẻ nhận xét của mình trên Google qua đường link này: [link]. Nhận xét nào, dù khen hay góp ý, cũng giúp chúng tôi làm tốt hơn và giúp người khác có thêm thông tin.
>
> Trân trọng,
> [Tên của bạn]

**Mẫu tiếng Anh:**

> Hi [Name],
>
> Thank you for working with spacegear on [project or phase]. If you have a few minutes, we would appreciate your honest feedback on Google: [link]. Every review, positive or critical, helps us improve and helps others decide.
>
> Best regards,
> [Your name]

### 7.3 Trả lời đánh giá

- Trả lời mọi đánh giá, tốt cũng như chưa tốt, trong vòng một đến hai ngày làm việc. Gọi khách bằng tên, ký tên hoặc tên viết tắt của người trả lời.
- Viết ngắn, lịch sự, trò chuyện tự nhiên, không quảng cáo, không chèn ưu đãi. Tránh lặp một câu cảm ơn giống hệt nhau cho mọi người.
- **Bảo mật thông tin khách.** Không xác nhận khách là ai, làm dự án gì, hay bất kỳ chi tiết nào mà chính khách chưa tự viết ra. Với một công ty tư vấn, điều này đặc biệt quan trọng.
- Với đánh giá chưa tốt: cảm ơn, xin lỗi nếu đúng là lỗi của mình, nói rõ điều gì bạn làm được và điều gì không, rồi mời khách liên hệ trực tiếp. Không tranh cãi, không công kích.
- Nếu một đánh giá vi phạm chính sách (giả mạo, lạc đề, xúc phạm, do đối thủ viết), hãy báo cáo đánh giá đó thay vì tranh cãi trong phần trả lời.

**Mẫu trả lời đánh giá tốt:**

> Cảm ơn anh/chị [Tên] đã dành thời gian chia sẻ. Chúng tôi rất vui vì [điều cụ thể khách đã nhắc đến]. Mong tiếp tục được đồng hành cùng anh/chị ở những bước tiếp theo. [Tên], spacegear

**Mẫu trả lời đánh giá chưa tốt:**

> Chào anh/chị [Tên], cảm ơn anh/chị đã phản hồi thẳng thắn. Chúng tôi xin lỗi vì [vấn đề khách nêu]. Chúng tôi muốn hiểu rõ hơn để xử lý cho đúng, mong anh/chị liên hệ trực tiếp qua 0386 749 799 hoặc admin@spacegear.tech. [Tên], spacegear

### 7.4 Người quản lý và quyền sở hữu

- **Vai trò:**
  - Một Hồ sơ có nhiều chủ sở hữu (Owner) nhưng chỉ có một **chủ sở hữu chính** (Primary owner).
  - Chủ sở hữu toàn quyền, kể cả thêm, xoá người và xoá Hồ sơ.
  - Người quản lý (Manager) làm được gần hết các việc khác, nhưng không thêm hay xoá người được và không xoá được Hồ sơ.
- **Cách thêm người:** vào business.google.com → **More** → **Business Profile settings** → **People and access** → **Add**, nhập email, chọn quyền **Owner** hoặc **Manager**, rồi bấm **Invite**.
- **Chủ sở hữu dự phòng:** ngay sau khi xác minh, hãy thêm một chủ sở hữu thứ hai. Đó có thể là tài khoản Google cá nhân của bạn, hoặc của một người bạn tin tưởng. Nếu tài khoản admin@spacegear.tech gặp sự cố (mất quyền Workspace, bị khoá), Hồ sơ vẫn còn người giữ.
  - Trong 7 ngày đầu, chủ sở hữu mới chưa được chuyển quyền sở hữu chính và chưa được xoá người khác.
  - Muốn chuyển quyền sở hữu chính thì Hồ sơ phải có ít nhất một chủ sở hữu hoặc người quản lý khác.
- **Đơn vị dịch vụ bên ngoài** (agency, đơn vị làm SEO) chỉ nên được cấp quyền **Manager**, không bao giờ là chủ sở hữu chính. Theo quy định của Google, họ phải trả lại quyền sở hữu ngay khi bạn yêu cầu.
- **Đăng nhập định kỳ.** Google có thể thu hồi quyền của chủ sở hữu lâu không đăng nhập, hoặc không liên lạc được qua email.

### 7.5 Hỏi & Đáp, tin nhắn và lịch sử cuộc gọi

- **Hỏi & Đáp (Q&A):** theo báo chí chuyên ngành, từ cuối năm 2025 Google bắt đầu gỡ phần Hỏi & Đáp công khai trên Google Maps và thay bằng tính năng hỏi đáp bằng AI (Ask Maps). Tính năng này dựa vào thông tin Hồ sơ, đánh giá và website để trả lời. Chưa có trang trợ giúp chính thức nào nói rõ lịch áp dụng tại Việt Nam. Nếu trang quản trị của bạn còn mục Hỏi & Đáp, hãy trả lời ngắn gọn và đúng sự thật. Dù thế nào, cách chắc chắn nhất là đưa những câu khách hay hỏi vào mô tả, phần dịch vụ và trang Câu hỏi thường gặp trên website.
- **Tin nhắn (chat) và lịch sử cuộc gọi:** theo báo chí chuyên ngành, Google đã tắt tính năng nhắn tin trên Hồ sơ từ ngày 31/7/2024 và bỏ luôn báo cáo lịch sử cuộc gọi. Khách liên hệ qua điện thoại, website hoặc biểu mẫu Liên hệ. Số lượt bấm gọi vẫn được đếm trong phần Hiệu suất.

### 7.6 Lịch kiểm tra

| Khi nào | Việc cần làm |
|---|---|
| Hằng tuần | Đọc và trả lời đánh giá mới. Xem thông báo và các cập nhật màu xanh do Google đề xuất (Google updates), chấp nhận hoặc sửa lại. |
| Hằng tháng | Một đến hai bài đăng. Xem số liệu Hiệu suất và lượt truy cập có UTM. Thêm ảnh mới nếu có. |
| Trước Tết và các ngày lễ | Khai giờ đặc biệt (Special hours) nếu Hồ sơ có giờ làm việc. |
| Hằng quý | Rà lại toàn bộ thông tin, danh mục, dịch vụ, mô tả. Đối chiếu NAP ở website, Bing, Apple và mạng xã hội. Kiểm tra danh sách người quản lý. |
| Khi có thay đổi lớn (chuyển địa chỉ, đổi tên, đổi số điện thoại) | Sửa website trước, rồi sửa Hồ sơ và các danh bạ khác. Chuyển địa chỉ thì phải xác minh lại; đổi tên cũng có thể phải xác minh lại. |

---

## 8. Những điều cần tránh để không bị khoá hồ sơ

### 8.1 Các vi phạm thường gặp

| Vi phạm | Ví dụ cần tránh |
|---|---|
| Nhồi từ khoá vào tên | "spacegear - Tư vấn AI & Chuyển đổi số TP.HCM" |
| Địa chỉ không đủ điều kiện | Văn phòng ảo, hộp thư, chỗ ngồi ở coworking không có biển hiệu và không có người trực |
| Hiện địa chỉ khi không đón khách | Hồ sơ hiện Số 11, đường B4 trong khi khách không thể đến đó trong giờ làm việc |
| Hồ sơ trùng lặp | Hai hồ sơ cho cùng doanh nghiệp, hoặc tạo hồ sơ mới khi hồ sơ cũ bị khoá |
| Đánh giá giả, đánh giá có thưởng | Xem mục 7.2 |
| Khu vực phục vụ quá rộng | Chọn cả nước, hoặc những tỉnh xa hơn khoảng 2 giờ lái xe mà bạn không thật sự phục vụ |
| Số điện thoại không do mình kiểm soát | Số tổng đài thuê ngoài, số tính cước cao |
| Website dẫn sang trang khác | Link website trỏ sang Facebook hoặc chuyển hướng sang trang không phải của spacegear |
| Sửa liên tục tên, địa chỉ, danh mục | Nhất là trong lúc đang chờ xác minh |
| Ảnh và bài đăng sai sự thật | Ảnh từ kho ảnh, ảnh do AI tạo, bài đăng có số điện thoại lạ |
| Trao quyền sai cách | Để đơn vị bên ngoài làm chủ sở hữu chính, dùng chung một tài khoản cho nhiều người |

### 8.2 Nếu Hồ sơ bị tạm ngưng

1. **Đừng tạo hồ sơ mới.** Google nói rõ không được tạo Hồ sơ mới cho cùng doanh nghiệp.
2. Sửa mọi điểm chưa đúng quy định trước. Google yêu cầu Hồ sơ tuân thủ đầy đủ hướng dẫn trước khi kháng nghị, nên đừng gửi kháng nghị khi tên vẫn còn từ khoá hay địa chỉ vẫn chưa hợp lệ.
3. Mở công cụ kháng nghị tại support.google.com/business/?p=manage_appeals, đăng nhập đúng tài khoản quản lý Hồ sơ, chọn Hồ sơ và quyết định cần kháng nghị.
4. Đính kèm bằng chứng có **tên và địa chỉ khớp với Hồ sơ**: giấy đăng ký kinh doanh, giấy phép, giấy tờ thuế, hoá đơn điện, nước, điện thoại hoặc internet. Viết ngắn gọn vì sao Hồ sơ đáp ứng quy định, rồi bấm **Submit appeal**.
5. **Mỗi quyết định chỉ được kháng nghị một lần**, nên hãy chuẩn bị kỹ trước khi gửi. Google trả lời qua email.
6. Nếu kháng nghị bị từ chối, bạn có thể gửi thêm bằng chứng mới qua support.google.com/business/contact/local_appeals.
7. Nếu chính tài khoản Google bị hạn chế, hãy kháng nghị tài khoản trước tại myaccount.google.com/restrictions, rồi mới kháng nghị Hồ sơ.

---

## 9. Bing Places và Apple Business

Hai nền tảng này ít người dùng ở Việt Nam hơn Google, nhưng nên có để NAP nhất quán. Bing Places cung cấp thông tin doanh nghiệp cho Bing và Bing Maps, còn Apple Business cung cấp thông tin cho Apple Maps. Làm sau khi Hồ sơ Google đã xác minh và thông tin đã ổn định.

### 9.1 Bing Places for Business

- Từ tháng 10/2025, Bing Places chuyển về địa chỉ **bing.com/forbusiness** (địa chỉ cũ bingplaces.com được chuyển hướng về đây).
- Cách nhanh nhất là nhập từ Google: đăng nhập bằng tài khoản Microsoft, chọn nhập từ Google Business Profile (Import from Google Business Profile), đăng nhập admin@spacegear.tech, cho phép truy cập, rồi chọn Hồ sơ spacegear. Theo các hướng dẫn bên thứ ba, có thể bật đồng bộ định kỳ để Bing tự cập nhật khi bạn sửa Hồ sơ Google.
- Sau khi nhập, kiểm tra lại danh mục (Bing dùng danh mục riêng) và địa chỉ (đặc biệt là tên phường mới). Nếu Bing không tự xác minh, hãy làm theo phương thức Bing đưa ra.
- Chúng tôi chưa xác nhận được Bing Places có nhận doanh nghiệp tại Việt Nam hay không. Nếu không thấy Việt Nam trong danh sách quốc gia, hãy bỏ qua bước này. Riêng việc gửi sơ đồ trang qua Bing Webmaster Tools thì vẫn nên làm.

### 9.2 Apple Business (trước đây là Apple Business Connect)

- Từ giữa tháng 4/2026, Apple gộp Business Connect và Business Manager thành **Apple Business** (business.apple.com). Dữ liệu cũ của Business Connect được chuyển sang tự động. Dịch vụ miễn phí, có mặt ở hơn 200 quốc gia và khu vực, nhưng một số tính năng chỉ có ở một số nước.
- Phần dành cho bản đồ cho phép nhận và quản lý thẻ địa điểm trên Apple Maps: tên, logo, ảnh, giờ làm việc, nút hành động.
- Hãy đăng nhập, kiểm tra xem có tạo được thẻ địa điểm cho Việt Nam không. Nếu được, dùng đúng bộ NAP ở mục 1.4 và cùng lựa chọn hiện hay ẩn địa chỉ như trên Google. Mức độ hỗ trợ cho Việt Nam chưa được xác nhận.

---

## 10. Nguồn tham khảo

Tất cả nguồn dưới đây được kiểm tra ngày **23/10/2026**. Ưu tiên trang trợ giúp chính thức của Google; nguồn bên thứ ba được ghi rõ.

**Google Business Profile Help (support.google.com/business):**

- Đăng ký Hồ sơ: https://support.google.com/business/answer/10514137
- Thêm hoặc nhận quyền sở hữu Hồ sơ: https://support.google.com/business/answer/2911778
- Hướng dẫn trình bày doanh nghiệp (tên, địa chỉ, khu vực phục vụ, giờ, danh mục, mô tả): https://support.google.com/business/answer/3038177
- Điều kiện và quyền sở hữu: https://support.google.com/business/answer/13763036
- Tổng quan chính sách: https://support.google.com/business/answer/13762416
- Xác minh doanh nghiệp: https://support.google.com/business/answer/7107242
- Xác minh bằng video: https://support.google.com/business/answer/14271705
- Quản lý địa chỉ và ẩn địa chỉ: https://support.google.com/business/answer/2853879
- Khu vực phục vụ: https://support.google.com/business/answer/9157481
- Chỉnh sửa Hồ sơ (mô tả 750 ký tự, điện thoại, website, giờ, liên kết mạng xã hội): https://support.google.com/business/answer/3039617
- Mô tả doanh nghiệp: https://support.google.com/business/answer/13682007
- Danh mục: https://support.google.com/business/answer/7249669
- Dịch vụ: https://support.google.com/business/answer/9455399
- Thuộc tính: https://support.google.com/business/answer/9049526
- Liên kết đặt lịch, đặt hàng: https://support.google.com/business/answer/6218037
- Chính sách liên kết doanh nghiệp: https://support.google.com/business/answer/13769188
- Ảnh và video: https://support.google.com/business/answer/6103862
- Chính sách nội dung ảnh, video, bài đăng: https://support.google.com/business/answer/7213077
- Bài đăng: https://support.google.com/business/answer/7342169
- Mẹo nhận thêm đánh giá và trả lời đánh giá: https://support.google.com/business/answer/3474122
- Link và mã QR xin đánh giá: https://support.google.com/business/answer/16816815
- Hạn chế với Hồ sơ vi phạm (đánh giá giả): https://support.google.com/business/answer/14114287
- Hồ sơ bị tạm ngưng và kháng nghị: https://support.google.com/business/answer/4569145
- Người dùng và quyền sở hữu: https://support.google.com/business/answer/3403100
- Hồ sơ doanh nghiệp và hồ sơ thương hiệu: https://support.google.com/business/answer/16394780
- Liên kết Hồ sơ với Google Analytics: https://support.google.com/business/answer/16987554 và https://support.google.com/analytics/answer/16930347

**Chính sách nội dung do người dùng đóng góp trên Google Maps** (tương tác giả, xung đột lợi ích, đánh giá có thưởng): https://support.google.com/contributionpolicy/answer/7400114

**Google Workspace**, bật Google Business Profile Manager cho người dùng: https://knowledge.workspace.google.com/admin/users/access/turn-google-business-profile-manager-on-or-off-for-users

**Dữ liệu biểu mẫu địa chỉ Việt Nam của Google** (63 tỉnh cũ, chỉ bắt buộc địa chỉ đường phố và tỉnh): https://www.gstatic.com/chrome/autofill/libaddressinput/chromium-i18n/ssl-address/data/VN

**Danh mục của Hồ sơ** (bản tổng hợp của bên thứ ba, cập nhật 9/5/2026): https://daltonluka.com/blog/google-my-business-categories

**Sắp xếp đơn vị hành chính:**

- Nghị quyết 1685/NQ-UBTVQH15 về sắp xếp đơn vị hành chính cấp xã của TP. Hồ Chí Minh năm 2025: https://luatvietnam.vn/hanh-chinh/nghi-quyet-1685-nq-ubtvqh15-2025-sap-xep-don-vi-hanh-chinh-cap-xa-tp-ho-chi-minh-403012-d1.html
- Phường An Khánh mới sau sáp nhập: https://mia.vn/cam-nang-du-lich/phuong-an-khanh-moi-sau-sap-nhap-19920
- Google Maps cập nhật địa giới cấp xã, phường (25/3/2026): https://vnreview.vn/threads/google-maps-cap-nhat-ban-do-den-cap-xa-phuong-o-viet-nam-sau-sap-nhap.80986/

**Hỏi & Đáp, tin nhắn, lịch sử cuộc gọi** (báo chí chuyên ngành, không phải trang của Google):

- PPC Land, 22/12/2025: https://ppc.land/google-quietly-kills-q-a-for-an-ai-button-most-wont-use/
- Search Engine Land, tin nhắn và lịch sử cuộc gọi: https://searchengineland.com/google-business-profile-chat-is-gone-and-call-history-going-away-444199

**Bing và Apple:**

- Bing, giới thiệu Bing Places for Business mới (3/10/2025): https://blogs.bing.com/search/October-2025/Introducing-the-New-Bing-Places-for-Business-Built-for-Business-Owners,-Powered-by-Research
- Hướng dẫn nhập Hồ sơ Google vào Bing (bên thứ ba, cập nhật 2/1/2026): https://daltonluka.com/blog/sync-bing-places-with-google-my-business
- Apple Newsroom, giới thiệu Apple Business (25/3/2026): https://www.apple.com/au/newsroom/2026/03/introducing-apple-business/

### Những điểm chưa xác minh được

- Phương thức xác minh nào đang được cấp cho doanh nghiệp tại Việt Nam (bưu thiếp, video, gọi video).
- Biểu mẫu địa chỉ trong Hồ sơ hiện có còn ô quận/huyện hay không, và có liệt kê 34 tỉnh, thành mới chưa. Bạn chỉ thấy được khi tự mở biểu mẫu.
- Tên danh mục khi giao diện là tiếng Việt. Ba danh mục đề xuất được đối chiếu với bản tổng hợp của bên thứ ba, chưa đối chiếu trực tiếp trong ô chọn danh mục của Google.
- Tính năng Hỏi & Đáp đã bị gỡ tại Việt Nam chưa.
- Bing Places và thẻ địa điểm Apple Maps có hỗ trợ doanh nghiệp tại Việt Nam hay không.
- Giới hạn ký tự của mô tả từng dịch vụ (trang trợ giúp không nêu).
