# Zebra Crossing Cpp
The files [zxing.js, zxing.wasm] are build artifacts from zxing (https://github.com/nu-book/zxing-cpp.git).

changes.patch contains the changes I made to BarcodeWriter.cpp to make it output the matrix instead of a png.

I used "cmake -DCMAKE_TOOLCHAIN_FILE=~/Documents/repos/emsdk/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake -DCMAKE_BUILD_TYPE=Release -G "Unix Makefiles" ../wrappers/wasm/" from my build folder to generate the build files and then ran "make install/local" to generate the artifacts.