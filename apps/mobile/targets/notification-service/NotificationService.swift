import Foundation
import UniformTypeIdentifiers
import UserNotifications

final class NotificationService: UNNotificationServiceExtension {
  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler deliver: @escaping (UNNotificationContent) -> Void
  ) {
    // Expo's APNs payload nests richContent inside body._richContent.
    guard let body = request.content.userInfo["body"] as? [String: Any],
      let richContent = body["_richContent"] as? [String: Any],
      let image = richContent["image"] as? String,
      let url = URL(string: image),
      url.scheme == "https", url.user == nil, url.password == nil,
      let content = request.content.mutableCopy() as? UNMutableNotificationContent
    else {
      deliver(request.content)
      return
    }

    let configuration = URLSessionConfiguration.ephemeral
    configuration.timeoutIntervalForResource = 8
    let session = URLSession(configuration: configuration)
    session.downloadTask(with: url) { file, response, _ in
      defer { deliver(content) }
      guard let file, let response = response as? HTTPURLResponse,
        (200..<300).contains(response.statusCode), response.url?.scheme == "https",
        let mimeType = response.mimeType, let type = UTType(mimeType: mimeType),
        type.conforms(to: .image), let suffix = type.preferredFilenameExtension,
        let size = try? file.resourceValues(forKeys: [.fileSizeKey]).fileSize,
        (1...2_000_000).contains(size)
      else { return }

      let destination = FileManager.default.temporaryDirectory
        .appendingPathComponent(UUID().uuidString).appendingPathExtension(suffix)
      do {
        try FileManager.default.moveItem(at: file, to: destination)
        content.attachments = [try UNNotificationAttachment(identifier: "image", url: destination)]
      } catch {
        // iOS can still display the alert when the attachment cannot be opened.
      }
    }.resume()
    session.finishTasksAndInvalidate()
  }
}
