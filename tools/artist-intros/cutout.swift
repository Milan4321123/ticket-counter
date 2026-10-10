// cutout in.jpg out.png [--people] — lifts the person(s) out of a photo with
// Apple's Vision subject mask (macOS 14+) and writes a PNG with transparency.
// --people uses person segmentation instead, which keeps every person in a
// group photo (the subject mask can drop someone standing at the edge).
import Foundation
import Vision
import CoreImage
import CoreImage.CIFilterBuiltins

let args = CommandLine.arguments
guard args.count >= 3 else { print("usage: cutout in.jpg out.png [--people]"); exit(1) }
let people = args.contains("--people")
let url = URL(fileURLWithPath: args[1])
guard let img = CIImage(contentsOf: url, options: [.applyOrientationProperty: true]) else { print("cannot read \(args[1])"); exit(1) }
let handler = VNImageRequestHandler(ciImage: img)
var mask: CIImage
var found = 0
if people {
  let req = VNGeneratePersonSegmentationRequest()
  req.qualityLevel = .accurate
  try handler.perform([req])
  guard let obs = req.results?.first else { print("no person in \(args[1])"); exit(2) }
  let m = CIImage(cvPixelBuffer: obs.pixelBuffer)
  mask = m.transformed(by: CGAffineTransform(scaleX: img.extent.width / m.extent.width, y: img.extent.height / m.extent.height))
  found = -1
} else {
  let req = VNGenerateForegroundInstanceMaskRequest()
  try handler.perform([req])
  guard let obs = req.results?.first else { print("no subject in \(args[1])"); exit(2) }
  mask = CIImage(cvPixelBuffer: try obs.generateScaledMaskForImage(forInstances: obs.allInstances, from: handler))
  found = obs.allInstances.count
}
let blend = CIFilter.blendWithMask()
blend.inputImage = img
blend.backgroundImage = CIImage.empty()
blend.maskImage = mask
let out = blend.outputImage!.cropped(to: img.extent)
let ctx = CIContext()
try ctx.writePNGRepresentation(of: out, to: URL(fileURLWithPath: args[2]), format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!)
print("\(args[2]): " + (found < 0 ? "people mask" : "\(found) subject(s)"))
