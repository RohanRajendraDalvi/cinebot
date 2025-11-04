#!/usr/bin/env python3
"""
Dependency Installation Script for CineBot Project

This script automatically installs all necessary Python dependencies for the CineBot project,
focused on Supabase integration, embeddings, and Groq API usage.

Usage:
    python install_dependencies.py

Features:
- Checks Python version compatibility
- Installs packages with proper error handling
- Provides clear feedback on installation progress
- Minimal, cross-platform installation
- Creates virtual environment if requested
"""

import subprocess
import sys
import os
import platform
from pathlib import Path

def check_python_version():
    """Check if Python version is compatible (3.8+)"""
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print(f"❌ Python {version.major}.{version.minor} detected. Python 3.8+ is required.")
        print("Please upgrade Python and try again.")
        return False
    
    print(f"✓ Python {version.major}.{version.minor}.{version.micro} detected - Compatible!")
    return True

def run_command(command, description):
    """Run a command with error handling and progress feedback"""
    print(f"\n📦 {description}...")
    try:
        result = subprocess.run(command, shell=True, check=True, 
                              capture_output=True, text=True)
        print(f"✓ {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed")
        print(f"Error: {e.stderr}")
        return False

def install_package(package_name, description=None):
    """Install a single package with pip"""
    if description is None:
        description = f"Installing {package_name}"
    
    command = f"pip install {package_name}"
    return run_command(command, description)

def install_requirements():
    """Install packages from requirements.txt files"""
    # Backend requirements
    backend_req = Path("backend/requirements.txt")
    if backend_req.exists():
        print("\n📋 Installing backend requirements...")
        if not run_command("pip install -r backend/requirements.txt", 
                          "Backend requirements installation"):
            return False
    
    # Supabase + ML + API requirements
    supabase_packages = [
        "psycopg2-binary",
        "python-dotenv", 
        "sentence-transformers",
        "pandas",
        "numpy",
        "scikit-learn"
    ]
    
    print("\n📋 Installing Supabase and ML packages...")
    for package in supabase_packages:
        if not install_package(package):
            print(f"⚠️  Failed to install {package}, but continuing...")
    
    return True

def install_faiss_windows():
    """Deprecated: FAISS no longer required. Keep for compatibility."""
    return True

def create_venv_if_needed():
    """Ask user if they want to create a virtual environment"""
    if "VIRTUAL_ENV" not in os.environ:
        response = input("\n🤔 No virtual environment detected. Create one? (y/N): ")
        if response.lower() in ['y', 'yes']:
            print("\n📁 Creating virtual environment...")
            if run_command("python -m venv .venv", "Virtual environment creation"):
                print("\n⚠️  Virtual environment created!")
                if platform.system() == "Windows":
                    print("To activate it, run: .venv\\Scripts\\activate")
                else:
                    print("To activate it, run: source .venv/bin/activate")
                print("Then run this script again.")
                return False
    else:
        print(f"✓ Virtual environment active: {os.environ['VIRTUAL_ENV']}")
    
    return True

def check_installations():
    """Verify that key packages were installed correctly"""
    test_packages = [
        ("pandas", "import pandas"),
        ("numpy", "import numpy"), 
        ("sentence_transformers", "from sentence_transformers import SentenceTransformer"),
        ("psycopg2", "import psycopg2"),
        ("flask", "import flask"),
        ("dotenv", "from dotenv import load_dotenv")
    ]
    
    print("\n🔍 Verifying package installations...")
    failed_packages = []
    
    for package_name, import_statement in test_packages:
        try:
            exec(import_statement)
            print(f"✓ {package_name}")
        except ImportError:
            print(f"❌ {package_name}")
            failed_packages.append(package_name)
    
    if failed_packages:
        print(f"\n⚠️  Some packages failed to install: {', '.join(failed_packages)}")
        print("You may need to install them manually or check for compatibility issues.")
        return False
    
    print("\n🎉 All packages verified successfully!")
    return True

def main():
    """Main installation process"""
    print("=" * 60)
    print("🤖 CineBot Project - Dependency Installation Script")
    print("=" * 60)
    
    # Check Python version
    if not check_python_version():
        return False
    
    # Check/create virtual environment
    if not create_venv_if_needed():
        return False
    
    # Upgrade pip first
    print("\n🔄 Upgrading pip...")
    run_command("python -m pip install --upgrade pip", "Pip upgrade")
    
    # Install FAISS (special handling for Windows)
    if not install_faiss_windows():
        print("⚠️  FAISS installation failed, but continuing...")
    
    # Install all requirements
    if not install_requirements():
        print("❌ Some installations failed")
        return False
    
    # Verify installations
    if not check_installations():
        print("⚠️  Some verifications failed")
        return False
    
    print("\n" + "=" * 60)
    print("🎉 Installation completed successfully!")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Set up your Supabase database URL in .env file")
    print("2. Enable pgvector extension in your Supabase dashboard")
    print("3. Run the Supabase training notebook to test the setup")
    print("\nFor more information, see the README.md file.")
    
    return True

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n⚠️  Installation interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)