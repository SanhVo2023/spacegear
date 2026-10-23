---
title: "Chúng tôi xây dựng spacegear.tech cùng các agent Claude Code"
summary: "Các agent Claude Code xây dựng phần lớn spacegear.tech theo bản đặc tả và kế hoạch, còn tôi ra quyết định. Quả địa cầu shader đưa trang chủ trên máy tính từ 7.753 xuống 1.747 KiB."
cover: /uploads/labs/how-we-built-spacegear-tech/cover.webp
coverAlt: "Quả địa cầu shader của spacegear.tech: Tây Phi và Đại Tây Dương lúc ban ngày, bầu khí quyển xanh trên nền trời đầy sao"
date: 2026-10-24
updated: ""
author: "Sanh Võ"
---

spacegear.tech chính thức hoạt động từ ngày 23/10/2026. Phần lớn site do các agent của Claude Code xây dựng theo bản đặc tả và kế hoạch viết sẵn, nhiều agent chạy cùng lúc, còn tôi đưa ra những quyết định cần đến con người. Thay đổi quan trọng nhất nằm ở quả địa cầu đầu trang: khi được làm lại bằng shader, nó không còn loang lổ, còn trang chủ trên máy tính giảm từ 7.753 KiB xuống 1.747 KiB trong bài kiểm tra trình duyệt của chúng tôi.

## Vấn đề chúng tôi cần giải quyết và các ràng buộc

spacegear là đơn vị tư vấn chuyển đổi số và AI, nên website phải thể hiện được điều đó mà không bịa ra bất cứ điều gì. Ngày 20/10, tôi đặt ra các nguyên tắc nền: tên miền là spacegear.tech, khách hàng có thể đến từ mọi ngành, mọi quy mô và mọi khu vực, site không để lộ dấu hiệu nào về quy mô công ty, còn mọi thứ chạy trên Cloudflare. Tối hôm đó Claude Code nhận việc xây dựng site. Từ đó trở đi, toàn bộ mã nguồn do Claude Code viết.

Trong bản dựng có một trình kiểm tra trung thực. Nó chặn giá, số lượng khách hàng, kết quả bịa đặt, văn phòng và lời hứa về thời hạn bàn giao trong mọi tệp nội dung. Bài viết này cũng đã đi qua trình kiểm tra đó.

## Cách chúng tôi làm việc với các agent

Một phiên Claude Code đóng vai trò điều phối. Ở mỗi giai đoạn, phiên này viết một bản đặc tả thiết kế để tôi duyệt, rồi chuyển nó thành kế hoạch gồm các tác vụ được đánh số, ghi rõ tệp, bài kiểm thử và lệnh cần chạy. Mỗi tác vụ được giao cho một agent mới. Các agent khác đối chiếu kết quả với bản đặc tả và rà soát mã. Mỗi khi lượt rà soát tìm ra lỗi thật, chúng tôi chạy thêm một vòng sửa. Sau đó đến các bước kiểm tra có số đo: lint, kiểm tra kiểu, kiểm thử đơn vị, quét SEO và kiểm tra trình duyệt với sáu cấu hình, từ điện thoại rộng 320 điểm ảnh đến trình duyệt tắt hẳn JavaScript. Phiên điều phối ghi sổ theo dõi commit và kết quả rà soát của từng tác vụ.

Công việc chạy song song, mỗi hướng trên một nhánh và thư mục riêng: quả địa cầu và CMS được làm cùng lúc, sau đó đến hệ thống chuyển động khi tôi muốn đẩy nhanh tiến độ. Các lượt build và chạy trình duyệt dùng chung một khóa.

Trước ngày 21/10, phần lớn tác vụ được giao cho Claude Sonnet, còn Claude Opus đảm nhận phần đầu trang và các lượt rà soát cuối. Từ ngày 21/10, theo yêu cầu của tôi, mọi agent đều chạy Claude Opus ở mức effort rất cao (xhigh).

Những quyết định sau đây do tôi đưa ra:

- tên miền, việc mở cửa cho mọi đối tượng khách hàng và việc không công bố quy mô công ty;
- nguyên tắc "làm đủ mọi mục, viết lại cho trung thực": mục nào cũng được giữ, nhưng chỉ nói điều có thật;
- thứ tự ưu tiên: quả địa cầu trước, rồi chuyển động táo bạo, rồi tốc độ tải, cuối cùng là CMS;
- ý tưởng logo B · Shift;
- việc hợp nhất vào nhánh phát hành và việc đưa site lên mạng;
- việc duyệt trang Chính sách quyền riêng tư và Điều khoản, cung cấp thông tin liên hệ và tự tay nhập khóa bí mật cho môi trường production;
- chiến lược ngôn ngữ: tiếng Anh giữ nguyên các URL hiện tại, tiếng Việt nằm dưới /vi/, do Claude viết và tôi chỉnh lại sau.

## Bước 1: chúng tôi làm nội dung trung thực trên một nền móng vững

Khi Claude Code nhận việc, site đã có sẵn phần nền móng: 12 trang tĩnh chạy trên Cloudflare Workers Static Assets, một Worker kiểm tra yêu cầu tư vấn bằng Turnstile rồi lưu vào D1, URL chuẩn và dữ liệu có cấu trúc, cùng 15 bài kiểm thử. Ở bước này, chúng tôi làm cho mục nào cũng trung thực và chắc chắn.

Toàn bộ nội dung được gom vào một tệp nội dung có kiểu dữ liệu rõ ràng, kèm các bài kiểm thử bắt buộc tuân theo quy tắc trung thực. Mục nào cũng phải nói điều có thật. Mục Hình thức hợp tác liệt kê ba cách làm việc cùng nhau, không kèm giá. Mục bảng số liệu, Những gì chúng tôi đo lường, có ghi rõ đây là ví dụ minh họa chứ không phải kết quả của khách hàng. Dòng thời gian quy trình đếm số đầu ra mà mỗi bước tạo ra. Mục Khách hàng nói gì và mục spacegear Labs chỉ hiển thị nội dung có thật, nên cả hai đều được ẩn khi site ra mắt.

![Mục Our Services trên site đang chạy: năm cột dịch vụ, cột đầu tiên mở ra trên nền cam, bên cạnh là thẻ Core Services](/uploads/labs/how-we-built-spacegear-tech/services.webp)

Phần việc người xem không nhìn thấy cũng quan trọng không kém. Chữ xám ở các câu dài được nâng độ tương phản từ 2,8:1 lên 5,1:1. Nội dung vẫn hiển thị khi không có JavaScript, còn bài kiểm tra trình duyệt sẽ báo lỗi nếu có chữ nào trong phần thân trang bị ẩn ở cấu hình tắt JavaScript hoặc giảm chuyển động. Đến cuối bước này, số bài kiểm thử đơn vị đã tăng từ 15 lên 29.

![Mục Our Process: bốn thẻ bước từ Assess đến Adopt trên một dòng thời gian, mỗi thẻ ghi các đầu ra của bước đó](/uploads/labs/how-we-built-spacegear-tech/process.webp)

## Bước 2: chúng tôi làm lại quả địa cầu cho giống Trái Đất thật

Quả địa cầu là việc tôi muốn làm trước tiên, vì lúc đó nó trông loang lổ và tối. Các agent mổ xẻ mô hình 3D và tìm ra nguyên nhân: kênh alpha của lớp mây bị đảo ngược, tức là đục ở chỗ trời quang, nên mỗi điểm ảnh trời quang lại phủ một lớp màng tối lên bề mặt.

Chúng tôi thay mô hình nặng 6.320.916 byte bằng một khối cầu với shader tự viết: mặt ngày được mặt trời chiếu sáng, đường ranh giới ngày đêm mềm với dải hoàng hôn màu cam của thương hiệu, ánh đèn thành phố ấm áp, ánh phản chiếu trên đại dương, địa hình nổi khối, một lớp mây đổ bóng riêng và bầu khí quyển phát sáng. Khi bạn cuộn trang, mặt trời quét qua, nên đèn thành phố bật sáng đúng lúc quả địa cầu vào giữa màn hình.

![Phần đầu trang khi đã cuộn được nửa chừng: quả địa cầu ở giữa với vầng sáng lưỡi liềm, dải hoàng hôn màu cam và đèn thành phố, trong khi câu tuyên bố hiện dần từng chữ](/uploads/labs/how-we-built-spacegear-tech/hero-centre.webp)

Một script tách năm bản đồ từ mô hình theo ba kích thước: 189.692 byte cho điện thoại, 660.662 byte cho khung hình đầu tiên trên máy tính và 2.182.272 byte cho bộ lớn nhất. Bộ lớn nhất chỉ được tải thêm về sau, trên máy tính có card đồ họa phần cứng và dùng chuột hoặc trackpad. Tệp mô hình cùng bộ giải nén của nó đã bị gỡ bỏ, quyền chạy WebAssembly trong chính sách bảo mật cũng vậy.

Trên máy tính, trang chủ giảm từ 7.753 KiB xuống 1.747 KiB. Cả hai con số đều do cùng một bài kiểm tra trình duyệt đo trên bản xem trước cục bộ: Chromium chạy không giao diện, một máy laptop, không giới hạn băng thông. Đây là số đo thử nghiệm cục bộ, không phải điểm Lighthouse hay dữ liệu từ người dùng thật.

![Biểu đồ cột: trang chủ trên máy tính giảm từ 7.753 KiB với quả địa cầu dạng mô hình xuống 1.747 KiB với quả địa cầu shader, còn tệp quả địa cầu cho khung hình đầu giảm từ 6.173 KiB xuống 645 KiB](/uploads/labs/how-we-built-spacegear-tech/chart-first-load-vi.webp)

Điện thoại và máy tính bảng giờ đây có quả địa cầu nhẹ của riêng mình. Quả địa cầu này chỉ được gắn vào trang sau khi trang đã tải xong và đứng yên.

![Phần đầu trang trên điện thoại rộng 390 điểm ảnh: tiêu đề, nút Discuss a project và quả địa cầu nhẹ nhô lên ở cuối màn hình](/uploads/labs/how-we-built-spacegear-tech/hero-phone.webp)

## Bước 3: chúng tôi thêm chuyển động nhưng đặt luật trước

Tiếp theo là hệ thống chuyển động: cuộn trang mượt, con trỏ tùy chỉnh, nút bấm có lực hút, tiêu đề hiện lên từng chữ cái, tấm màn cam khi chuyển trang, biểu đồ tự vẽ khi bạn cuộn tới và các chữ cái ở chân trang nhô lên khi tấm màn mở ra.

![Mục What We Measure: bảng số liệu minh họa với biểu đồ quy trình, các vòng chỉ báo theo từng bước và biểu đồ cột, có ghi rõ là ví dụ chứ không phải kết quả của khách hàng](/uploads/labs/how-we-built-spacegear-tech/measure.webp)

Luật quan trọng hơn hiệu ứng. Hiệu ứng nặng chỉ chạy trên máy tính dùng chuột hoặc trackpad, màn hình rộng từ 1.024 điểm ảnh, khi người xem cho phép chuyển động. Điện thoại, máy tính bảng và những người chọn giảm chuyển động không bao giờ phải tải bộ cuộn mượt hay con trỏ. Khi không có JavaScript, mọi thứ hiển thị ở trạng thái cuối. Hiệu ứng chỉ thay đổi transform và opacity. Kết quả là cấu hình máy tính không đo được dịch chuyển bố cục hay tác vụ dài nào, còn chuyển động không làm mục nào cao thêm.

![Chân trang với chữ spacegear cỡ lớn sau khi các chữ cái đã nhô lên, các cột liên kết và biểu mẫu Start with one challenge](/uploads/labs/how-we-built-spacegear-tech/footer-wordmark.webp)

## Bước 4: chúng tôi làm logo và trình soạn nội dung

Tôi muốn thay dòng chữ tạm có dấu gạch ngang bằng một bộ nhận diện thật. Một agent làm theo quy trình thiết kế logo rồi dừng ở bước cần người chọn. Tôi chọn phương án B · Shift: một hành tinh bị cắt dọc theo dấu gạch cũ, hai nửa trượt lệch nhau, gợi "khoảnh khắc một doanh nghiệp sang số". Chữ spacegear được dựng hình riêng, không gõ bằng phông chữ. Ký hiệu ™ chỉ xuất hiện ở dòng chữ lớn dưới chân trang, còn trình kiểm tra chặn ký hiệu nhãn hiệu đã đăng ký cho đến khi nhãn hiệu thật sự được đăng ký. Việc tra cứu nhãn hiệu vẫn nằm trong danh sách việc của tôi.

![Logo spacegear màu cam trên nền tối: bản ngang, bản xếp chồng, biểu tượng hành tinh bị cắt đôi và chữ spacegear](/uploads/labs/how-we-built-spacegear-tech/logo.webp)

![Cách dựng logo: một hành tinh cắt theo đường xích đạo, khe cắt và độ trượt đều bằng 0,26 bán kính, chữ spacegear căn theo khe cắt](/uploads/labs/how-we-built-spacegear-tech/logo-construction.webp)

Cùng lúc đó, nội dung được chuyển ra khỏi mã nguồn, sang các tệp JSON và Markdown mà Sveltia CMS 0.230.1 chỉnh sửa tại /admin/. CMS từ chối ảnh tải lên có chứa dữ liệu vị trí GPS. Với mỗi ảnh, CMS còn tạo bản WebP rộng 640 và 1.280 điểm ảnh. Một bài kiểm tra ảnh chụp HTML so sánh mọi trang trước và sau khi chuyển: kết quả giống hệt nhau.

![Màn hình đăng nhập của trình soạn nội dung spacegear.tech tại /admin/, với biểu tượng hành tinh bị cắt đôi và hai nút đăng nhập](/uploads/labs/how-we-built-spacegear-tech/admin-sign-in.webp)

Nút GitHub cho phép người biên tập đăng bài từ bất kỳ trình duyệt nào. Khi làm việc trên bản sao ở máy cá nhân, nút còn lại cho phép sửa thẳng các tệp của dự án.

## Bước 5: spacegear.tech chính thức hoạt động

Ngày 22/10, tôi quyết định hợp nhất toàn bộ công việc vào nhánh phát hành. Hôm sau, tôi yêu cầu đưa site lên mạng. Kể từ đó, một Cloudflare Worker đảm nhận việc phục vụ spacegear.tech. Bản phát hành đầu tiên gồm 12 trang chính và 181 tệp, tổng dung lượng 10,67 MiB. Bài kiểm tra SEO cho môi trường production đã đạt trên tên miền thật. Tính năng nhận yêu cầu tư vấn đã bật; thông báo qua email vẫn tắt cho đến khi địa chỉ gửi được xác minh.

![Phần đầu trang spacegear.tech trên máy tính: tiêu đề The smarter way to plan, build, and scale your business trên nền quả địa cầu ban ngày](/uploads/labs/how-we-built-spacegear-tech/hero-desktop.webp)

## Những vòng sửa chúng tôi đã trải qua

Từ ngày 20 đến 23/10, Claude Code đã tạo 222 commit trên nhánh phát hành, chưa tính các commit hợp nhất. Trong số đó, 70 commit bắt đầu bằng "fix" và 67 commit bắt đầu bằng "feat". Ở phần quả địa cầu và CMS, 17 trên 20 tác vụ được rà soát chất lượng phải qua ít nhất một vòng sửa mới đạt. Dưới đây là vài vòng như thế:

- **Một quả địa cầu trắng, được phát hiện trước khi ra mắt.** Một lượt rà soát toàn nhánh phát hiện chính sách bảo mật chặn các texture nhúng trong mô hình, nên bản production lẽ ra sẽ hiện một quả địa cầu trắng làm nhòe cả tiêu đề. Tệ hơn, một quy tắc header thứ hai đã xóa mất chính sách bảo mật khỏi bản xem trước cục bộ, nên mọi lượt kiểm tra trình duyệt trước đó đều chạy mà không có nó. Giờ đây bài kiểm tra trình duyệt xác nhận chính sách này trên mọi đường dẫn.
- **Một bước kiểm tra báo động giả.** Khoảng 0,6 kilobyte mã kiểm tra mới khiến bộ đóng gói tách một chunk. Bài kiểm tra ảnh chụp HTML liền báo cả 15 trang đều thay đổi, dù mã HTML vẫn y nguyên. Chúng tôi viết lại bước kiểm tra để so sánh cây React đã được phân giải.
- **Một bộ đếm giờ chập chờn.** Lần tải lên đầu tiên của bộ texture lớn nhất được phép mất 120 mili giây. Khi máy đang bận, ba trong bốn lượt chạy sạch đo được 135, 153 và 170 mili giây, rồi dưới 50 mili giây khi chạy lại trên một trang mới. Giờ đây bài kiểm tra đo lại một lần trước khi báo lỗi.
- **Con số nhỏ, lỗi thật.** Rê chuột lên một thẻ ở mục Dịch vụ từng làm bố cục xê dịch (CLS 0,02 đến 0,04); giờ chỉ số này bằng 0. Hiệu ứng đèn chiếu trên thẻ từng làm chữ xám cỡ nhỏ chỉ còn độ tương phản 3,81:1; giờ mức thấp nhất là 4,57:1. Ở phần đầu trang, trước đây có 14 lớp được đẩy lên GPU ngay khi tải trang; giờ không còn lớp nào.
- **Tài liệu biến thành CSS.** Tailwind quét mọi tệp mà Git theo dõi, nên tên class được trích trong các bản kế hoạch trở thành style của site. Chỉ riêng việc loại thư mục tài liệu ra đã bỏ được 27 quy tắc. Giờ đây Tailwind chỉ quét thư mục mã nguồn.
- **Con trỏ chuột.** Tôi muốn giữ con trỏ tùy chỉnh nhưng phải phản hồi tức thì. Chúng tôi từng cho rằng chấm con trỏ chậm một khung hình. Số đo cho thấy không phải vậy: chấm đã được vẽ ngay ở khung hình đầu tiên sau mỗi sự kiện. Thứ thực sự thay đổi là vòng tròn. Một bộ bám giảm chấn tới hạn thay cho lò xo, nhờ đó thời gian để vòng dừng hẳn giảm từ 234–358 mili giây xuống 67–114 mili giây trong bảy trường hợp đo. Chúng tôi cũng bỏ chế độ hòa trộn màu trên quả địa cầu và đổi đĩa hiện ra khi rê chuột thành một lớp trắng mờ. Với thay đổi này, số bài kiểm thử đơn vị lên tới 309, so với 15 lúc Claude Code mới nhận việc.

![Biểu đồ cột: thời gian vòng con trỏ dừng hẳn trong bảy trường hợp, từ 234 đến 358 mili giây với lò xo cũ xuống còn 67 đến 114 mili giây với bộ bám mới](/uploads/labs/how-we-built-spacegear-tech/chart-cursor-vi.webp)

## Nếu làm lại, chúng tôi sẽ làm khác những gì

- **Kiểm tra bằng mắt trên trình duyệt thật theo lịch cố định.** Mới chỉ có một lượt kiểm tra giao diện chạy trên card đồ họa máy tính; phần lớn các lượt kiểm tra bằng mắt sau đó vẫn nằm trong danh sách việc của tôi.
- **Đo giả định trước khi lên kế hoạch sửa.** Kế hoạch cho con trỏ đã giả định một độ trễ không hề tồn tại.
- **Tách tài liệu khỏi bản dựng ngay từ đầu.** Câu chữ trong bản kế hoạch không bao giờ nên trở thành CSS.
- **Nói rõ mỗi con số là gì.** Mọi bản ghi ở đây đều nêu điều kiện đo của nó.

## Tiếp theo chúng tôi sẽ làm gì

Bài viết này lên mạng cùng lúc với hai phần việc khác. Phần thứ nhất là bản song ngữ: nội dung tiếng Việt cho mọi tệp nội dung, phiên bản /vi/ có chuyển hướng theo khu vực và nút đổi ngôn ngữ, cùng các mẫu kiểm tra trung thực dành cho tiếng Việt. Phần thứ hai là spacegear Labs, chuyên mục bạn đang đọc. Việc tiếp theo trong danh sách của tôi là các lượt kiểm tra bằng mắt trên trình duyệt thật, cùng những bài nhật ký dự án khác được viết theo cùng một cách: ảnh chụp thật, số liệu đo được và giữ nguyên cả những ngõ cụt đã gặp.

Hãy [cho chúng tôi biết bạn muốn cải thiện điều gì](/contact/) nếu bạn muốn làm một dự án tương tự mà mọi quyết định vẫn nằm trong tay bạn.
